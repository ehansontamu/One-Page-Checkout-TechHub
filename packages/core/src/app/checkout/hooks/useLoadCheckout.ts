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
    // Even when BigCommerce has preloaded checkout data, TechHub must reset that state before
    // rendering the form. Start in the loading state for every page mount.
    const [isLoadingCheckout, setIsLoadingCheckout] = useState(true);
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
    };

    useEffect(() => {
        const loadAndResetCheckout = async () => {
            if (!data.getCheckout()) {
                if (initialState) {
                    await hydrateInitialState(initialState);
                } else {
                    // If the initial data has not been preloaded from the server, fetch it first.
                    await fetchDataWithRetry();
                }
            }

            await resetCheckoutSession();
            setIsLoadingCheckout(false);
        };

        void loadAndResetCheckout();
    }, []);

    return { isLoadingCheckout };
};
