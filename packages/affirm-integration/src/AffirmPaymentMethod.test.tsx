import {
    CheckoutSelectors,
    CheckoutService,
    createCheckoutService,
    createLanguageService,
} from '@bigcommerce/checkout-sdk';
import React, { FunctionComponent } from 'react';

import {
    createLocaleContext,
    LocaleContext,
    LocaleContextType,
} from '@bigcommerce/checkout/locale';
import {
    PaymentFormService,
    PaymentMethodProps,
} from '@bigcommerce/checkout/payment-integration-api';
import {
    getCart,
    getCustomer,
    getPaymentFormServiceMock,
    getStoreConfig,
} from '@bigcommerce/checkout/test-mocks';
import { render, screen } from '@bigcommerce/checkout/test-utils';

import AffirmPaymentMethod from './AffirmPaymentMethod';

describe('When using Affirm Payment Method', () => {
    let checkoutService: CheckoutService;
    let defaultProps: PaymentMethodProps;
    let checkoutState: CheckoutSelectors;
    let paymentForm: PaymentFormService;

    let PaymentMethodTest: FunctionComponent<PaymentMethodProps>;
    let localeContext: LocaleContextType;

    beforeEach(() => {
        checkoutService = createCheckoutService();
        checkoutState = checkoutService.getState();
        paymentForm = getPaymentFormServiceMock();

        jest.spyOn(checkoutState.data, 'getConfig').mockReturnValue(getStoreConfig());
        jest.spyOn(checkoutState.data, 'getCart').mockReturnValue(getCart());
        jest.spyOn(checkoutState.data, 'getCustomer').mockReturnValue(getCustomer());
        jest.spyOn(checkoutService, 'deinitializePayment').mockResolvedValue(checkoutState);

        localeContext = createLocaleContext(getStoreConfig());

        defaultProps = {
            method: {
                id: 'affirm',
                method: 'barclaycard',
                supportedCards: [],
                config: {},
                type: 'card',
                gateway: 'affirm',
            },
            checkoutService,
            checkoutState,
            paymentForm,
            language: createLanguageService(),
            onUnhandledError: jest.fn(),
        };

        PaymentMethodTest = (props) => (
            <LocaleContext.Provider value={localeContext}>
                <AffirmPaymentMethod {...props} />
            </LocaleContext.Provider>
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Shopper is able to see Affirm Payment Method', () => {
        render(<PaymentMethodTest {...defaultProps} />);

        expect(
            screen.getByText(localeContext.language.translate('payment.affirm_body_text')),
        ).toBeInTheDocument();
    });
});
