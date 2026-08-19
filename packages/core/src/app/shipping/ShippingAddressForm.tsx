import { type Address, type Consignment, type FormField } from '@bigcommerce/checkout-sdk';
import React, { type ReactElement, useEffect, useRef } from 'react';

import { useCapabilities, useCheckout, useThemeContext } from '@bigcommerce/checkout/contexts';
import { Fieldset, LoadingOverlay } from '@bigcommerce/checkout/ui';

import {
    AddressForm,
    AddressType,
    decodeAddressLabel,
    isValidCustomerAddress,
    reorderAddressFormFields,
} from '../address';
import { connectFormik, type ConnectFormikProps } from '../common/form';

import { type SingleShippingFormValues } from './SingleShippingForm';

export interface ShippingAddressFormProps {
    address?: Address;
    consignments: Consignment[];
    isLoading: boolean;
    formFields: FormField[];
    validateMaxLength: boolean;
    onUseNewAddress(): void;
    onFieldChange(fieldName: string, value: string): void;
    onAddressSelect(address: Address): void;
}

const addressFieldName = 'shippingAddress';

const ShippingAddressForm = ({
    address: shippingAddress,
    onUseNewAddress,
    formFields,
    isLoading,
    validateMaxLength,
    formik: {
        values: { shippingAddress: formAddress },
        setFieldValue: formikSetFieldValue,
    },
    onFieldChange,
}: ShippingAddressFormProps & ConnectFormikProps<SingleShippingFormValues>): ReactElement => {
    const {
        selectedState: { customer },
    } = useCheckout(({ data }) => ({ customer: data.getCustomer() }));
    const { enhancedThemeV1 } = useThemeContext();
    const {
        userJourney: { hasAddressLabel },
    } = useCapabilities();

    const rawAddresses = customer?.addresses || [];
    const addresses = rawAddresses.map((address) => decodeAddressLabel(address, hasAddressLabel));
    const decodedShippingAddress = decodeAddressLabel(shippingAddress, hasAddressLabel);
    const hasClearedSavedAddress = useRef(false);

    const setFieldValue = (fieldName: string, fieldValue: string) => {
        const customFormFieldNames = formFields
            .filter((field) => field.custom)
            .map((field) => field.name);

        const formFieldName = customFormFieldNames.includes(fieldName)
            ? `customFields.${fieldName}`
            : fieldName;

        void formikSetFieldValue(`${addressFieldName}.${formFieldName}`, fieldValue);
    };

    const handleChange = (fieldName: string, value: string) => {
        onFieldChange(fieldName, value);
    };

    const handleAutocompleteToggle = ({
        isOpen,
        inputValue,
    }: {
        inputValue: string;
        isOpen: boolean;
    }) => {
        if (!isOpen) {
            onFieldChange('address1', inputValue);
        }
    };

    const hasSavedAddressSelected = isValidCustomerAddress(
        decodedShippingAddress,
        addresses,
        formFields,
        validateMaxLength,
    );

    useEffect(() => {
        if (!hasSavedAddressSelected || hasClearedSavedAddress.current) {
            return;
        }

        hasClearedSavedAddress.current = true;
        onUseNewAddress();
    }, [hasSavedAddressSelected, onUseNewAddress]);

    const sortedFormFields = enhancedThemeV1 ? reorderAddressFormFields(formFields) : formFields;

    return (
        <Fieldset id="checkoutShippingAddress">
            <LoadingOverlay isLoading={isLoading} unmountContentWhenLoading>
                <AddressForm
                    countryCode={formAddress && formAddress.countryCode}
                    fieldName={addressFieldName}
                    formFields={sortedFormFields}
                    onAutocompleteToggle={handleAutocompleteToggle}
                    onChange={handleChange}
                    setFieldValue={setFieldValue}
                    shouldShowSaveAddress={false}
                    type={AddressType.Shipping}
                />
            </LoadingOverlay>
        </Fieldset>
    );
};

export default connectFormik(ShippingAddressForm);
