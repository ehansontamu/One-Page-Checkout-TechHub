import {
    Address,
    CheckoutParams,
    CheckoutSelectors,
    Consignment,
    Country,
    CustomerAddress,
    CustomerRequestOptions,
    FormField,
    RequestOptions,
    ShippingInitializeOptions,
    ShippingRequestOptions,
} from '@bigcommerce/checkout-sdk';
import { FormikProps } from 'formik';
import { debounce, isEqual, noop } from 'lodash';
import React, { PureComponent, ReactNode } from 'react';
import { lazy, object } from 'yup';

import { withLanguage, WithLanguageProps } from '@bigcommerce/checkout/locale';
import { FormContext } from '@bigcommerce/checkout/ui';

import {
    AddressFormValues,
    getAddressFormFieldsValidationSchema,
    getTranslateAddressError,
    isEqualAddress,
    mapAddressFromFormValues,
    mapAddressToFormValues,
} from '../address';
import { withFormikExtended } from '../common/form';
import { getCustomFormFieldsValidationSchema } from '../formFields';
import { PaymentMethodId } from '../payment/paymentMethod';
import { Fieldset, Form } from '../ui/form';

import BillingSameAsShippingField from './BillingSameAsShippingField';
import hasSelectedShippingOptions from './hasSelectedShippingOptions';
import ShippingAddress from './ShippingAddress';
import { SHIPPING_ADDRESS_FIELDS } from './ShippingAddressFields';
import ShippingFormFooter from './ShippingFormFooter';
import isSelectedShippingOptionValid from './isSelectedShippingOptionValid';

export interface SingleShippingFormProps {
    addresses: CustomerAddress[];
    isBillingSameAsShipping: boolean;
    cartHasChanged: boolean;
    consignments: Consignment[];
    countries: Country[];
    countriesWithAutocomplete: string[];
    customerMessage: string;
    googleMapsApiKey?: string;
    isLoading: boolean;
    isShippingStepPending: boolean;
    isMultiShippingMode: boolean;
    methodId?: string;
    shippingAddress?: Address;
    shippingAutosaveDelay?: number;
    shouldShowSaveAddress?: boolean;
    shouldShowOrderComments: boolean;
    isFloatingLabelEnabled?: boolean;
    isInitialValueLoaded: boolean;
    shippingFormRenderTimestamp?: number;
    deinitialize(options: ShippingRequestOptions): Promise<CheckoutSelectors>;
    deleteConsignments(): Promise<Address | undefined>;
    getFields(countryCode?: string): FormField[];
    initialize(options: ShippingInitializeOptions): Promise<CheckoutSelectors>;
    onSubmit(values: SingleShippingFormValues): void;
    onUnhandledError?(error: Error): void;
    signOut(options?: CustomerRequestOptions): void;
    updateAddress(
        address: Partial<Address>,
        options?: RequestOptions<CheckoutParams>,
    ): Promise<CheckoutSelectors>;
}

export interface SingleShippingFormValues {
    billingSameAsShipping: boolean;
    shippingAddress?: AddressFormValues;
    orderComment: string;
}

interface SingleShippingFormState {
    isResettingAddress: boolean;
    isUpdatingShippingData: boolean;
    hasRequestedShippingOptions: boolean;
}

function shouldHaveCustomValidation(methodId?: string): boolean {
    const methodIdsWithoutCustomValidation: string[] = [
        PaymentMethodId.BraintreeAcceleratedCheckout,
        PaymentMethodId.PayPalCommerceAcceleratedCheckout,
    ];

    return Boolean(methodId && !methodIdsWithoutCustomValidation.includes(methodId));
}

export const SHIPPING_AUTOSAVE_DELAY = 1700;

class SingleShippingForm extends PureComponent<
    SingleShippingFormProps & WithLanguageProps & FormikProps<SingleShippingFormValues>
> {
    static contextType = FormContext;

    state: SingleShippingFormState = {
        isResettingAddress: false,
        isUpdatingShippingData: false,
        hasRequestedShippingOptions: false,
    };

    private debouncedUpdateAddress: any;

    constructor(
        props: SingleShippingFormProps & WithLanguageProps & FormikProps<SingleShippingFormValues>,
    ) {
        super(props);

        const { updateAddress } = this.props;

        this.debouncedUpdateAddress = debounce(
            async (address: Address, includeShippingOptions: boolean) => {
                try {
                    await updateAddress(address, {
                        params: {
                            include: {
                                'consignments.availableShippingOptions': includeShippingOptions,
                            },
                        },
                    });

                    if (includeShippingOptions) {
                        this.setState({ hasRequestedShippingOptions: true });
                    }
                } finally {
                    this.setState({ isUpdatingShippingData: false });
                }
            },
            props.shippingAutosaveDelay ?? SHIPPING_AUTOSAVE_DELAY,
        );
    }

    componentDidUpdate({ shippingFormRenderTimestamp }: SingleShippingFormProps) {
        const {
            shippingFormRenderTimestamp: newShippingFormRenderTimestamp,
            setValues,
            getFields,
            shippingAddress,
            isBillingSameAsShipping,
            customerMessage,
        } = this.props;

        if (newShippingFormRenderTimestamp !== shippingFormRenderTimestamp) {
            // Map the address to form values
            const addressFormValues = mapAddressToFormValues(
                getFields(shippingAddress && shippingAddress.countryCode),
                shippingAddress,
            );

            // Reset custom fields if they exist
            if (addressFormValues.customFields) {
                // Get the list of custom form fields
                const customFields = getFields(shippingAddress && shippingAddress.countryCode)
                    .filter(field => field.custom);
                
                // Reset each custom field to empty values based on its type
                customFields.forEach(field => {
                    if (field.fieldType === 'checkbox') {
                        addressFormValues.customFields[field.name] = [];
                    } else if (field.type === 'date') {
                        addressFormValues.customFields[field.name] = '';
                    } else if (field.type === 'integer') {
                        addressFormValues.customFields[field.name] = '';
                    } else {
                        addressFormValues.customFields[field.name] = '';
                    }
                });
            }

            setValues({
                billingSameAsShipping: isBillingSameAsShipping,
                orderComment: customerMessage,
                shippingAddress: addressFormValues,
            });
        }
    }

    render(): ReactNode {
        const {
            addresses,
            cartHasChanged,
            isInitialValueLoaded,
            isLoading,
            onUnhandledError,
            methodId,
            shouldShowSaveAddress,
            countries,
            countriesWithAutocomplete,
            googleMapsApiKey,
            shippingAddress,
            consignments,
            shouldShowOrderComments,
            initialize,
            isValid,
            deinitialize,
            values: { shippingAddress: addressForm },
            isShippingStepPending,
            isFloatingLabelEnabled,
            shippingFormRenderTimestamp,
        } = this.props;

        const { isResettingAddress, isUpdatingShippingData, hasRequestedShippingOptions } =
            this.state;

        const PAYMENT_METHOD_VALID = ['amazonpay'];
        const shouldShowBillingSameAsShipping = !PAYMENT_METHOD_VALID.some(
            (method) => method === methodId,
        );

        return (
            <Form autoComplete="on">
                <Fieldset>
                    <ShippingAddress
                        addresses={addresses}
                        consignments={consignments}
                        countries={countries}
                        countriesWithAutocomplete={countriesWithAutocomplete}
                        deinitialize={deinitialize}
                        formFields={this.getFields(addressForm && addressForm.countryCode)}
                        googleMapsApiKey={googleMapsApiKey}
                        hasRequestedShippingOptions={hasRequestedShippingOptions}
                        initialize={initialize}
                        isFloatingLabelEnabled={isFloatingLabelEnabled}
                        isLoading={isResettingAddress}
                        isShippingStepPending={isShippingStepPending}
                        methodId={methodId}
                        onAddressSelect={this.handleAddressSelect}
                        onFieldChange={this.handleFieldChange}
                        onUnhandledError={onUnhandledError}
                        onUseNewAddress={this.onUseNewAddress}
                        shippingAddress={shippingAddress}
                        shouldShowSaveAddress={shouldShowSaveAddress}
                    />
                    {shouldShowBillingSameAsShipping && (
                        <div className="form-body">
                            <BillingSameAsShippingField />
                        </div>
                    )}
                </Fieldset>

                <ShippingFormFooter
                    cartHasChanged={cartHasChanged}
                    isInitialValueLoaded={isInitialValueLoaded}
                    isLoading={isLoading || isUpdatingShippingData}
                    isMultiShippingMode={false}
                    shippingFormRenderTimestamp={shippingFormRenderTimestamp}
                    shouldDisableSubmit={this.shouldDisableSubmit()}
                    shouldShowOrderComments={shouldShowOrderComments}
                    shouldShowShippingOptions={isValid}
                />
            </Form>
        );
    }

    private shouldDisableSubmit: () => boolean = () => {
        const { isLoading, consignments } = this.props;
        const { isUpdatingShippingData } = this.state;

<<<<<<< HEAD
        // Don't check form validity here - let the form submit and let validation 
        // errors be displayed naturally
        return isLoading || isUpdatingShippingData || !hasSelectedShippingOptions(consignments);
=======
        if (!isValid) {
            return false;
        }

        return isLoading || isUpdatingShippingData || !hasSelectedShippingOptions(consignments) || !isSelectedShippingOptionValid(consignments);
>>>>>>> 32f569aee3731cb52bb1146d30374e7d75d1133d
    };

    private handleFieldChange: (name: string) => void = async (name) => {
        const { setFieldValue } = this.props;

        if (name === 'countryCode') {
            setFieldValue('shippingAddress.stateOrProvince', '');
            setFieldValue('shippingAddress.stateOrProvinceCode', '');
        }

        // Enqueue the following code to run after Formik has run validation
        await new Promise((resolve) => setTimeout(resolve));

        const isShippingField = SHIPPING_ADDRESS_FIELDS.includes(name);

        const { hasRequestedShippingOptions } = this.state;

        const { isValid } = this.props;

        if (!isValid) {
            return;
        }

        this.updateAddressWithFormData(isShippingField || !hasRequestedShippingOptions);
    };

    private updateAddressWithFormData(includeShippingOptions: boolean) {
        const {
            shippingAddress,
            values: { shippingAddress: addressForm },
        } = this.props;

        const updatedShippingAddress = addressForm && mapAddressFromFormValues(addressForm);

        if (Array.isArray(shippingAddress?.customFields)) {
            includeShippingOptions = !isEqual(
                shippingAddress?.customFields,
                updatedShippingAddress?.customFields
            ) || includeShippingOptions;
        }

        if (!updatedShippingAddress || isEqualAddress(updatedShippingAddress, shippingAddress)) {
            return;
        }

        this.setState({ isUpdatingShippingData: true });
        this.debouncedUpdateAddress(updatedShippingAddress, includeShippingOptions);
    }

    private handleAddressSelect: (address: Address) => void = async (address) => {
        const { updateAddress, onUnhandledError = noop, values, setValues } = this.props;

        this.setState({ isResettingAddress: true });

        try {
            await updateAddress(address);

            // Map the address to form values
            const addressFormValues = mapAddressToFormValues(
                this.getFields(address.countryCode),
                address,
            );

            // Reset custom fields if they exist
            if (addressFormValues.customFields) {
                // Get the list of custom form fields
                const customFields = this.getFields(address.countryCode)
                    .filter(field => field.custom);
                
                // Reset each custom field to empty values based on its type
                customFields.forEach(field => {
                    if (field.fieldType === 'checkbox') {
                        addressFormValues.customFields[field.name] = [];
                    } else if (field.type === 'date') {
                        addressFormValues.customFields[field.name] = '';
                    } else if (field.type === 'integer') {
                        addressFormValues.customFields[field.name] = '';
                    } else {
                        addressFormValues.customFields[field.name] = '';
                    }
                });
            }

            setValues({
                ...values,
                shippingAddress: addressFormValues,
            });
        } catch (error) {
            onUnhandledError(error);
        } finally {
            this.setState({ isResettingAddress: false });
        }
    };

    private onUseNewAddress: () => void = async () => {
        const { deleteConsignments, onUnhandledError = noop, setValues, values } = this.props;

        this.setState({ isResettingAddress: true });

        try {
            const address = await deleteConsignments();

            // Map the address to form values
            const addressFormValues = mapAddressToFormValues(
                this.getFields(address && address.countryCode),
                address,
            );

            // Reset custom fields if they exist
            if (addressFormValues.customFields) {
                // Get the list of custom form fields
                const customFields = this.getFields(address && address.countryCode)
                    .filter(field => field.custom);
                
                // Reset each custom field to empty values based on its type
                customFields.forEach(field => {
                    if (field.fieldType === 'checkbox') {
                        addressFormValues.customFields[field.name] = [];
                    } else if (field.type === 'date') {
                        addressFormValues.customFields[field.name] = '';
                    } else if (field.type === 'integer') {
                        addressFormValues.customFields[field.name] = '';
                    } else {
                        addressFormValues.customFields[field.name] = '';
                    }
                });
            }

            setValues({
                ...values,
                shippingAddress: addressFormValues,
            });
        } catch (e) {
            onUnhandledError(e);
        } finally {
            this.setState({ isResettingAddress: false });
        }
    };

    private getFields(countryCode: string | undefined): FormField[] {
        const { getFields } = this.props;

        return getFields(countryCode);
    }
}

export default withLanguage(
    withFormikExtended<SingleShippingFormProps & WithLanguageProps, SingleShippingFormValues>({
        handleSubmit: (values, { props: { onSubmit } }) => {
            onSubmit(values);
        },
        mapPropsToValues: ({
            getFields,
            shippingAddress,
            isBillingSameAsShipping,
            customerMessage,
        }) => ({
            billingSameAsShipping: isBillingSameAsShipping,
            orderComment: customerMessage,
            shippingAddress: mapAddressToFormValues(
                getFields(shippingAddress && shippingAddress.countryCode),
                shippingAddress,
            ),
        }),
        isInitialValid: ({ shippingAddress, getFields, language }) =>
            !!shippingAddress &&
            getAddressFormFieldsValidationSchema({
                language,
                formFields: getFields(shippingAddress.countryCode),
            }).isValidSync(shippingAddress),
        validationSchema: ({
            language,
            getFields,
            methodId,
        }: SingleShippingFormProps & WithLanguageProps) =>
            shouldHaveCustomValidation(methodId)
                ? object({
                      shippingAddress: lazy<Partial<AddressFormValues>>((formValues) =>
                          getCustomFormFieldsValidationSchema({
                              translate: getTranslateAddressError(language),
                              formFields: getFields(formValues && formValues.countryCode),
                          }),
                      ),
                  })
                : object({
                      shippingAddress: lazy<Partial<AddressFormValues>>((formValues) =>
                          getAddressFormFieldsValidationSchema({
                              language,
                              formFields: getFields(formValues && formValues.countryCode),
                          }),
                      ),
                  }),
        enableReinitialize: false,
    })(SingleShippingForm),
);
