import type { ExtensionRegion as CheckoutSdkExtensionRegion } from '@bigcommerce/checkout-sdk';

// The Checkout SDK exposes this as a `declare const enum`, which has no runtime
// JavaScript value when checkout is built with transpile-only TypeScript handling.
// Keep the API's exact string values available to the browser.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const ExtensionRegion = {
    ShippingShippingAddressFormBefore: 'shipping.shippingAddressForm.before',
    ShippingShippingAddressFormAfter: 'shipping.shippingAddressForm.after',
    ShippingSelectedShippingMethod: 'shipping.selectedShippingMethod',
    PaymentPaymentMethodListBefore: 'payment.paymentMethodList.before',
    SummaryAfter: 'summary.after',
    SummaryLastItemAfter: 'summary.lastItem.after',
    GlobalWebWorker: 'global',
} as unknown as {
    readonly ShippingShippingAddressFormBefore: CheckoutSdkExtensionRegion;
    readonly ShippingShippingAddressFormAfter: CheckoutSdkExtensionRegion;
    readonly ShippingSelectedShippingMethod: CheckoutSdkExtensionRegion;
    readonly PaymentPaymentMethodListBefore: CheckoutSdkExtensionRegion;
    readonly SummaryAfter: CheckoutSdkExtensionRegion;
    readonly SummaryLastItemAfter: CheckoutSdkExtensionRegion;
    readonly GlobalWebWorker: CheckoutSdkExtensionRegion;
};
