import { type Address, type FormField, isExtraField } from '@bigcommerce/checkout-sdk/essential';
import { type FormikProps, withFormik } from 'formik';
import React, { type RefObject, useEffect, useRef } from 'react';

import { useCapabilities, useCheckout } from '@bigcommerce/checkout/contexts';
import {
    TranslatedString,
    withLanguage,
    type WithLanguageProps,
} from '@bigcommerce/checkout/locale';
import {
    AddressFormSkeleton,
    Button,
    ButtonVariant,
    Fieldset,
    Form,
} from '@bigcommerce/checkout/ui';

import { AddressForm, AddressType, decodeAddressLabel, isValidCustomerAddress } from '../address';
import { OrderComments } from '../orderComments';
import { getShippableItemsCount } from '../shipping';

import {
    type BillingFormValues,
    getBillingFormInitialValues,
    getBillingFormValidationSchema,
} from './billingFormConfig';
import StaticBillingAddress from './StaticBillingAddress';

export type { BillingFormValues } from './billingFormConfig';

export interface BillingFormProps {
    methodId?: string;
    billingAddress?: Address;
    customerMessage: string;
    navigateNextStep(): void;
    onSubmit(values: BillingFormValues): void;
    onUnhandledError(error: Error): void;
    getFields(countryCode?: string): FormField[];
    updateBillingAddress(address: Partial<Address>): Promise<unknown>;
}

const BillingForm = ({
    methodId,
    getFields,
    billingAddress,
    setFieldValue,
    values,
    onUnhandledError,
    updateBillingAddress,
}: BillingFormProps & WithLanguageProps & FormikProps<BillingFormValues>) => {
    const isResettingAddress = false;
    const addressFormRef: RefObject<HTMLFieldSetElement> = useRef(null);

    const {
        selectedState: { customer, config, cart, isUpdatingBillingAddress, isUpdatingCheckout },
    } = useCheckout(({ data, statuses }) => ({
        customer: data.getCustomer(),
        config: data.getConfig(),
        cart: data.getCart(),
        isUpdatingBillingAddress: statuses.isUpdatingBillingAddress(),
        isUpdatingCheckout: statuses.isUpdatingCheckout(),
    }));
    const {
        userJourney: { hasAddressLabel },
    } = useCapabilities();

    if (!config || !customer || !cart) {
        throw new Error('checkout data is not available');
    }

    const rawAddresses = customer.addresses;
    const shouldRenderStaticAddress = methodId === 'amazonpay';
    const allFormFields = getFields(values.countryCode);
    const customOrExtraFields = allFormFields.filter(
        (field) => field.custom || isExtraField(field),
    );
    const hasCustomOrExtraFields = customOrExtraFields.length > 0;
    const editableFormFields =
        shouldRenderStaticAddress && hasCustomOrExtraFields ? customOrExtraFields : allFormFields;
    const rawBillingAddresses = rawAddresses;

    const billingAddresses = rawBillingAddresses.map((address) =>
        decodeAddressLabel(address, hasAddressLabel),
    );

    const hasValidCustomerAddress =
        billingAddress &&
        isValidCustomerAddress(
            billingAddress,
            billingAddresses,
            getFields(billingAddress.countryCode),
        );
    const isUpdating = isUpdatingBillingAddress || isUpdatingCheckout;
    const { enableOrderComments } = config.checkoutSettings;
    const shouldShowOrderComments = enableOrderComments && getShippableItemsCount(cart) < 1;
    const hasClearedSavedAddress = useRef(false);

    useEffect(() => {
        if (!hasValidCustomerAddress || hasClearedSavedAddress.current) {
            return;
        }

        hasClearedSavedAddress.current = true;
        void updateBillingAddress({}).catch((error: unknown) => {
            if (error instanceof Error) {
                onUnhandledError(error);
            }
        });
    }, [hasValidCustomerAddress, onUnhandledError, updateBillingAddress]);

    return (
        <Form autoComplete="on">
            {shouldRenderStaticAddress && billingAddress && (
                <div className="form-fieldset">
                    <StaticBillingAddress address={billingAddress} />
                </div>
            )}

            <Fieldset id="checkoutBillingAddress" ref={addressFormRef}>
                {!shouldRenderStaticAddress && (
                    <AddressFormSkeleton isLoading={isResettingAddress}>
                        <AddressForm
                            countryCode={values.countryCode}
                            formFields={editableFormFields}
                            setFieldValue={setFieldValue}
                            shouldShowSaveAddress={false}
                            type={AddressType.Billing}
                        />
                    </AddressFormSkeleton>
                )}
            </Fieldset>

            {shouldShowOrderComments && <OrderComments />}

            <div className="form-actions">
                <Button
                    className="optimizedCheckout-contentPrimary body-bold"
                    disabled={isUpdating || isResettingAddress}
                    id="checkout-billing-continue"
                    isLoading={isUpdating || isResettingAddress}
                    type="submit"
                    variant={ButtonVariant.Primary}
                >
                    <TranslatedString id="common.continue_action" />
                </Button>
            </div>
        </Form>
    );
};

export default withLanguage(
    withFormik<BillingFormProps & WithLanguageProps, BillingFormValues>({
        handleSubmit: (values, { props: { onSubmit } }) => {
            onSubmit(values);
        },
        mapPropsToValues: ({ getFields, customerMessage, billingAddress }) =>
            getBillingFormInitialValues(getFields, billingAddress, customerMessage),
        validateOnMount: true,
        validationSchema: ({
            language,
            getFields,
            methodId,
        }: BillingFormProps & WithLanguageProps) =>
            getBillingFormValidationSchema(language, getFields, methodId),
        enableReinitialize: true,
    })(BillingForm),
);
