import { type Address, type ConsignmentCreateRequestBody } from '@bigcommerce/checkout-sdk';
import React, { useState } from 'react';

import {
    AddressFormModal,
    type AddressFormValues,
    isValidAddress,
    mapAddressFromFormValues,
} from '../address';

import { AssignItemFailedError, AssignItemInvalidAddressError } from './errors';
import GuestCustomerAddressSelector from './GuestCustomerAddressSelector';
import { useShipping } from './hooks/useShipping';
import { type MultiShippingConsignmentData } from './MultishippingType';
import { setRecommendedOrMissingShippingOption } from './utils';

interface ConsignmentAddressSelectorProps {
    consignment?: MultiShippingConsignmentData;
    defaultCountryCode?: string;
    isLoading: boolean;
    onUnhandledError(error: Error): void;
    setConsignmentRequest?(consignmentRequest: ConsignmentCreateRequestBody): void;
    selectedAddress?: Address;
}

const ConsignmentAddressSelector = ({
    consignment,
    defaultCountryCode,
    isLoading,
    onUnhandledError,
    setConsignmentRequest,
}: ConsignmentAddressSelectorProps) => {
    const [isOpenNewAddressModal, setIsOpenNewAddressModal] = useState(false);

    const {
        getFields,
        selectConsignmentShippingOption,
        updateConsignment,
        getConsignments: getPreviousConsignments,
    } = useShipping();

    const handleSelectAddress = async (rawAddress: Address) => {
        const address = rawAddress;

        if (!isValidAddress(address, getFields(address.countryCode), true)) {
            return onUnhandledError(new AssignItemInvalidAddressError());
        }

        if (!consignment) {
            setConsignmentRequest?.({
                address,
                shippingAddress: address,
                lineItems: [],
            });

            return;
        }

        try {
            const {
                data: { getConsignments },
            } = await updateConsignment({
                id: consignment.id,
                address,
                shippingAddress: address,
                lineItems: consignment.lineItems.map(({ id, quantity }) => ({
                    itemId: id,
                    quantity,
                })),
            });

            const currentConsignments = getConsignments();

            if (currentConsignments && currentConsignments.length > 0) {
                await setRecommendedOrMissingShippingOption(
                    getPreviousConsignments() ?? [],
                    currentConsignments,
                    selectConsignmentShippingOption,
                );
            }
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(new AssignItemFailedError(error));
            }
        }
    };

    const handleUseNewAddress = () => {
        setIsOpenNewAddressModal(true);
    };

    const handleCloseAddAddressForm = () => {
        setIsOpenNewAddressModal(false);
    };

    const handleSaveAddress = async (addressFormValues: AddressFormValues) => {
        const address = mapAddressFromFormValues(addressFormValues);

        await handleSelectAddress(address);

        setIsOpenNewAddressModal(false);
    };

    return (
        <>
            <AddressFormModal
                defaultCountryCode={defaultCountryCode}
                getFields={getFields}
                isLoading={isLoading}
                isOpen={isOpenNewAddressModal}
                onRequestClose={handleCloseAddAddressForm}
                onSaveAddress={handleSaveAddress}
                selectedAddress={undefined}
                shouldShowSaveAddress={false}
            />
            <GuestCustomerAddressSelector onUseNewAddress={handleUseNewAddress} />
        </>
    );
};

export default ConsignmentAddressSelector;
