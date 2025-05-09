import {
    Address,
    AddressRequestBody,
    Cart,
    CheckoutSelectors,
    CheckoutStoreSelector,
    Consignment,
    ConsignmentAssignmentRequestBody,
    Country,
    CustomerAddress,
    FormField,
} from '@bigcommerce/checkout-sdk';
import { FormikProps } from 'formik';
import React, { PureComponent, ReactNode } from 'react';

import { TranslatedString, withLanguage, WithLanguageProps } from '@bigcommerce/checkout/locale';

import {
    AddressFormModal,
    AddressFormValues,
    isValidAddress,
    mapAddressFromFormValues,
} from '../address';
import { ErrorModal } from '../common/error';
import { withFormikExtended } from '../common/form';
import { Form } from '../ui/form';

import { AssignItemFailedError, AssignItemInvalidAddressError } from './errors';
import getShippableItemsCount from './getShippableItemsCount';
import getShippableLineItems from './getShippableLineItems';
import hasSelectedShippingOptions from './hasSelectedShippingOptions';
import hasUnassignedLineItems from './hasUnassignedLineItems';
import ItemAddressSelect from './ItemAddressSelect';
import ShippableItem from './ShippableItem';
import ShippingFormFooter from './ShippingFormFooter';
import updateShippableItems from './updateShippableItems';

export interface MultiShippingFormProps {
    addresses: CustomerAddress[];
    cart: Cart;
    cartHasChanged: boolean;
    consignments: Consignment[];
    customerMessage: string;
    isLoading: boolean;
    shouldShowOrderComments: boolean;
    defaultCountryCode?: string;
    countries?: Country[];
    countriesWithAutocomplete: string[];
    googleMapsApiKey?: string;
    isFloatingLabelEnabled?: boolean;
    isInitialValueLoaded: boolean;
    validateAddressFields: boolean;
    assignItem(consignment: ConsignmentAssignmentRequestBody): Promise<CheckoutSelectors>;
    createCustomerAddress(address: AddressRequestBody): void;
    getFields(countryCode?: string): FormField[];
    onSubmit(values: MultiShippingFormValues): void;
    onUnhandledError(error: Error): void;
    onUseNewAddress(address: Address, itemId: string): void;
}

interface ShippableItemId {
    key: string;
    itemId: string;
}

export interface MultiShippingFormState {
    items: ShippableItem[];
    itemAddingAddress?: ShippableItemId;
    createCustomerAddressError?: Error;
}

class MultiShippingForm extends PureComponent<
    MultiShippingFormProps & WithLanguageProps & FormikProps<MultiShippingFormValues>,
    MultiShippingFormState
> {
    static getDerivedStateFromProps(
        { cart, consignments }: MultiShippingFormProps,
        state: MultiShippingFormState,
    ) {
        if (!state || !state.items || getShippableItemsCount(cart) !== state.items.length) {
            return { items: getShippableLineItems(cart, consignments) };
        }

        return null;
    }

    state: MultiShippingFormState = { items: [] };

    render(): ReactNode {
        const {
            addresses,
            consignments,
            cart,
            cartHasChanged,
            shouldShowOrderComments,
            isInitialValueLoaded,
            isLoading,
            getFields,
            defaultCountryCode,
            countries,
            countriesWithAutocomplete,
            googleMapsApiKey,
            isFloatingLabelEnabled,
        } = this.props;

        const { items, itemAddingAddress, createCustomerAddressError } = this.state;

        return (
            <>
                <ErrorModal
                    error={createCustomerAddressError}
                    message={
                        <>
                            <TranslatedString id="address.consignment_address_updated_text" />{' '}
                            <TranslatedString id="customer.create_address_error" />
                        </>
                    }
                    onClose={this.handleCloseErrorModal}
                    shouldShowErrorCode={false}
                />
                <AddressFormModal
                    countries={countries}
                    countriesWithAutocomplete={countriesWithAutocomplete}
                    defaultCountryCode={defaultCountryCode}
                    getFields={getFields}
                    googleMapsApiKey={googleMapsApiKey}
                    isFloatingLabelEnabled={isFloatingLabelEnabled}
                    isLoading={isLoading}
                    isOpen={!!itemAddingAddress}
                    onRequestClose={this.handleCloseAddAddressForm}
                    onSaveAddress={this.handleSaveAddress}
                />

                <Form>
                    <ul className="consignmentList">
                        {items.map((item) => (
                            <li key={item.key}>
                                <ItemAddressSelect
                                    addresses={addresses}
                                    item={item}
                                    onSelectAddress={this.handleSelectAddress}
                                    onUseNewAddress={this.handleUseNewAddress}
                                />
                            </li>
                        ))}
                    </ul>

                    <ShippingFormFooter
                        cartHasChanged={cartHasChanged}
                        isInitialValueLoaded={isInitialValueLoaded}
                        isLoading={isLoading}
                        isMultiShippingMode={true}
                        shouldDisableSubmit={this.shouldDisableSubmit()}
                        shouldShowOrderComments={shouldShowOrderComments}
                        shouldShowShippingOptions={
                            !hasUnassignedLineItems(consignments, cart.lineItems)
                        }
                    />
                </Form>
            </>
        );
    }

    private handleCloseErrorModal: () => void = () => {
        this.setState({ createCustomerAddressError: undefined });
    };

    private handleSaveAddress: (address: AddressFormValues) => void = async (address) => {
        const { createCustomerAddress } = this.props;
        const { itemAddingAddress } = this.state;

        if (!itemAddingAddress) {
            return;
        }

        const shippingAddress = mapAddressFromFormValues(address);

        await this.handleSelectAddress(
            shippingAddress,
            itemAddingAddress.itemId,
            itemAddingAddress.key,
        );

        try {
            await createCustomerAddress(shippingAddress);
        } catch (error) {
            if (error instanceof Error) {
                this.setState({ createCustomerAddressError: error });
            }
        }

        this.setState({
            itemAddingAddress: undefined,
        });
    };

    private handleUseNewAddress: (itemId: string, itemKey: string) => void = (
        itemId,
        itemKey,
    ) => {
        this.setState({
            itemAddingAddress: {
                key: itemKey,
                itemId,
            },
        });
    };

    private handleCloseAddAddressForm: () => void = () => {
        this.setState({
            itemAddingAddress: undefined,
        });
    };

    private handleSelectAddress: (
        address: Address,
        itemId: string,
        itemKey: string,
    ) => Promise<void> = async (address, itemId, itemKey) => {
        const { assignItem, onUnhandledError, getFields, validateAddressFields } = this.props;

        if (!isValidAddress(address, getFields(address.countryCode), validateAddressFields)) {
            return onUnhandledError(new AssignItemInvalidAddressError());
        }

        try {
            const { data } = await assignItem({
                address,
                lineItems: [
                    {
                        itemId,
                        quantity: 1,
                    },
                ],
            });

            this.syncItems(itemKey, address, data);
        } catch (error) {
            if (error instanceof Error) {
                onUnhandledError(new AssignItemFailedError(error));
            }
        }
    };

    private shouldDisableSubmit: () => boolean = () => {
        const { isLoading, consignments } = this.props;

        return isLoading || !hasSelectedShippingOptions(consignments);
    };

    private syncItems: (key: string, address: Address, data: CheckoutStoreSelector) => void = (
        key,
        address,
        data,
    ) => {
        const { items: currentItems } = this.state;
        const items = updateShippableItems(
            currentItems,
            {
                updatedItemIndex: currentItems.findIndex((item) => item.key === key),
                address,
            },
            {
                cart: data.getCart(),
                consignments: data.getConsignments(),
            },
        );

        if (items) {
            this.setState({ items });
        }
    };
}

export interface MultiShippingFormValues {
    orderComment: string;
}

export default withLanguage(
    withFormikExtended<MultiShippingFormProps & WithLanguageProps, MultiShippingFormValues>({
        handleSubmit: (values, { props: { onSubmit } }) => {
            onSubmit(values);
        },
        mapPropsToValues: ({ customerMessage }) => ({
            orderComment: customerMessage,
        }),
        enableReinitialize: true,
    })(MultiShippingForm),
);
