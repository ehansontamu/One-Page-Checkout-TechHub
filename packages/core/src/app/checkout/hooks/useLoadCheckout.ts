import { type CheckoutInitialState } from '@bigcommerce/checkout-sdk';
import { useEffect, useState } from 'react';

import { useCheckout, useExtensions } from '@bigcommerce/checkout/contexts';

import { yieldToMain } from '../../common/utility';

export const useLoadCheckout = (
    checkoutId: string,
    initialState?: CheckoutInitialState,
): { isLoadingCheckout: boolean } => {
    // no reason to subscribe to getCheckout() here because we only use it to set isLoadingCheckout state on mount
    const {
        checkoutService,
        checkoutState: { data },
    } = useCheckout(() => undefined);
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(!data.getCheckout());
    const { extensionService } = useExtensions();

    const fetchData = async () => {
        await Promise.all([
            checkoutService.loadCheckout(checkoutId, {
                params: {
                    include: [
                        'cart.lineItems.physicalItems.categoryNames',
                        'cart.lineItems.digitalItems.categoryNames',
                    ] as any, // FIXME: Currently the enum is not exported so it can't be used here.
                },
            }),
            extensionService.loadExtensions(),
        ]);
    };

    // A checkout session can retain addresses, the selected shipping option, and order comments
    // after a shopper leaves the page. TechHub requires a fresh form on every new page load, so
    // clear that server-side checkout state before the checkout UI is allowed to render.
    const resetCheckoutSession = async () => {
        const checkout = data.getCheckout();

        if (!checkout) {
            return;
        }

        const consignments = data.getConsignments() || [];
        const requests = consignments.map(({ id }) => checkoutService.deleteConsignment(id));

        if (data.getBillingAddress()) {
            requests.push(checkoutService.updateBillingAddress({}));
        }

        if (checkout.customerMessage) {
            requests.push(checkoutService.updateCheckout({ customerMessage: '' }));
        }

        await Promise.all(requests);
    };

    const fetchDataWithRetry = async (maxRetries = 3): Promise<void> => {
        const attemptFetch = async (attemptSequence = 1): Promise<void> => {
            try {
                await fetchData();
            } catch {
                if (attemptSequence >= maxRetries) {
                    throw new Error('Failed to load checkout after 3 attempts, please try again.');
                }

                const delay = attemptSequence ** 2 * 1000;

                await new Promise((resolve) => setTimeout(resolve, delay));

                await attemptFetch(attemptSequence + 1);
            }
        };

        await attemptFetch();
    };

    const hydrateInitialState = async (initialState: CheckoutInitialState) => {
        await yieldToMain();
        await checkoutService.hydrateInitialState(initialState);
        await resetCheckoutSession();
        setIsLoadingCheckout(false);
    };

    useEffect(() => {
        if (!isLoadingCheckout) {
            return;
        }

        if (!initialState) {
            // If the initial data has not been preloaded from the server, we need to make API calls to fetch it.
            fetchDataWithRetry()
                .then(resetCheckoutSession)
                .then(() => setIsLoadingCheckout(false))
                .catch((error) => {
                    throw error;
                });
        } else {
            hydrateInitialState(initialState);
        }
    }, []);

    return { isLoadingCheckout };
};
