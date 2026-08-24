import { type FormField, isExtraField } from '@bigcommerce/checkout-sdk/essential';
import { forIn, noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCapabilities, useCheckout, useLocale } from '@bigcommerce/checkout/contexts';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { isPayPalFastlaneMethod } from '@bigcommerce/checkout/paypal-fastlane-integration';
import {
    type AutocompleteItem,
    DynamicFormField,
    DynamicFormFieldType,
    Fieldset,
} from '@bigcommerce/checkout/ui';
import { isExperimentEnabled } from '@bigcommerce/checkout/utility';

import { EMPTY_ARRAY, isFloatingLabelEnabled } from '../common/utility';
import getProviderWithCustomCheckout from '../payment/getProviderWithCustomCheckout';
import {
    getTechHubFieldOptionLabel,
    getTechHubDeliveryLocations,
    isTechHubField,
    loadTechHubDeliveryLocations,
    shouldHideTechHubAddressField,
} from '../techhub/techhub';

import {
    type AddressFormProps,
    AUTOCOMPLETE,
    AUTOCOMPLETE_FIELD_NAME,
    LABEL,
    PLACEHOLDER,
} from './AddressFormType';
import AddressLabelFormField from './AddressLabelFormField';
import AddressType from './AddressType';
import {
    getAddressFormFieldInputId,
    getAddressFormFieldLegacyName,
} from './getAddressFormFieldInputId';
import { GoogleAutocompleteFormField, mapToAddress } from './googleAutocomplete';
import './AddressForm.scss';

const AddressForm: React.FC<AddressFormProps> = ({
    formFields,
    fieldName,
    countryCode,
    onAutocompleteToggle,
    setFieldValue = noop,
    onChange = noop,
    type,
}) => {
    const {
        userJourney: { hasAddressLabel },
    } = useCapabilities();
    const { language } = useLocale();
    const {
        selectedState: { config, countries },
    } = useCheckout(({ data }) => ({
        config: data.getConfig(),
        countries:
            (type === AddressType.Billing
                ? data.getBillingCountries()
                : data.getShippingCountries()) ?? EMPTY_ARRAY,
    }));
    const googleMapsApiKey = config?.checkoutSettings.googleMapsApiKey || '';
    const isFloatingLabelEnabledValue = config
        ? isFloatingLabelEnabled(config.checkoutSettings)
        : false;
    const isPayPalFastlaneEnabled = isPayPalFastlaneMethod(
        getProviderWithCustomCheckout(config?.checkoutSettings.providerWithCustomCheckout),
    );
    // PayPal Fastlane stores keep the legacy phone input for now, due to incident
    const isNewPhoneValidationExperimentEnabled =
        !isPayPalFastlaneEnabled &&
        isExperimentEnabled(
            config?.checkoutSettings,
            'CHECKOUT-9019.use_new_phone_number_validation',
            false,
        );
    const isNewGooglePlacesApiEnabled = isExperimentEnabled(
        config?.checkoutSettings,
        'CHECKOUT-10026.new_google_places_api',
        false,
    );
    const countriesWithAutocomplete = ['US', 'CA', 'AU', 'NZ', 'GB'];

    const containerRef = useRef<HTMLDivElement>(null);
    const nextElementRef = useRef<HTMLElement | null>(null);
    const [selectedCollegeUnit, setSelectedCollegeUnit] = useState('');
    const [deliveryLocationsStatus, setDeliveryLocationsStatus] = useState<
        'idle' | 'loading' | 'loaded' | 'unavailable'
    >('idle');
    const collegeUnitField = useMemo(
        () => formFields.find((field) => isTechHubField(field, 'collegeUnit')),
        [formFields],
    );
    const deliveryLocationField = useMemo(
        () => formFields.find((field) => isTechHubField(field, 'deliveryLocation')),
        [formFields],
    );
    const deliveryLocations = getTechHubDeliveryLocations(selectedCollegeUnit);

    useEffect(() => {
        const { current } = containerRef;

        if (current) {
            nextElementRef.current = current.querySelector<HTMLElement>(
                '[autocomplete="address-line2"]',
            );
        }
    }, []);

    useEffect(() => {
        if (!collegeUnitField) {
            return;
        }

        const collegeUnitInput = document.getElementById(
            getAddressFormFieldInputId(collegeUnitField.name),
        ) as HTMLInputElement | HTMLSelectElement | null;

        if (!collegeUnitInput) {
            return;
        }

        const updateSelectedCollegeUnit = () => {
            const selectedOption =
                collegeUnitInput instanceof HTMLSelectElement
                    ? collegeUnitInput.selectedOptions[0]
                    : undefined;

            setSelectedCollegeUnit(
                selectedOption?.textContent ||
                    getTechHubFieldOptionLabel(collegeUnitField, collegeUnitInput.value),
            );
        };

        updateSelectedCollegeUnit();
        collegeUnitInput.addEventListener('change', updateSelectedCollegeUnit);

        return () => {
            collegeUnitInput.removeEventListener('change', updateSelectedCollegeUnit);
        };
    }, [collegeUnitField?.name]);

    useEffect(() => {
        if (!deliveryLocationField || !selectedCollegeUnit) {
            setDeliveryLocationsStatus('idle');

            return;
        }

        let isActive = true;

        setDeliveryLocationsStatus('loading');

        void loadTechHubDeliveryLocations()
            .then(() => {
                if (isActive) {
                    setDeliveryLocationsStatus('loaded');
                }
            })
            .catch(() => {
                if (isActive) {
                    setDeliveryLocationsStatus('unavailable');
                }
            });

        return () => {
            isActive = false;
        };
    }, [deliveryLocationField?.name, selectedCollegeUnit]);

    const syncNonFormikValue = useCallback(
        (fieldName: string, value: string | string[]) => {
            const dateFormFieldNames = formFields
                .filter((field) => field.custom && field.fieldType === DynamicFormFieldType.DATE)
                .map((field) => field.name);

            if (fieldName === AUTOCOMPLETE_FIELD_NAME || dateFormFieldNames.includes(fieldName)) {
                setFieldValue(fieldName, value);
            }

            onChange(fieldName, value);
        },
        [formFields, setFieldValue, onChange],
    );

    const handleDynamicFormFieldChange = useCallback(
        (field: FormField) => (value: string | string[]) => {
            if (isTechHubField(field, 'collegeUnit') && deliveryLocationField) {
                setSelectedCollegeUnit(
                    typeof value === 'string' ? getTechHubFieldOptionLabel(field, value) : '',
                );
                setFieldValue(deliveryLocationField.name, '');
                onChange(deliveryLocationField.name, '');
            }

            syncNonFormikValue(field.name, value);
        },
        [deliveryLocationField, onChange, setFieldValue, syncNonFormikValue],
    );

    const handleAutocompleteChange = useCallback(
        (value: string, isOpen: boolean) => {
            if (!isOpen) {
                syncNonFormikValue(AUTOCOMPLETE_FIELD_NAME, value);
            }
        },
        [syncNonFormikValue],
    );

    const handleAutocompleteSelect = useCallback(
        (place: google.maps.places.PlaceResult, item: AutocompleteItem) => {
            const { value: autocompleteValue } = item;

            const address = mapToAddress(place, countries);

            forIn(address, (value, fieldName) => {
                if (fieldName === AUTOCOMPLETE_FIELD_NAME && value === undefined) {
                    return;
                }

                setFieldValue(fieldName, value as string);
            });

            const address1 = address.address1 ? address.address1 : autocompleteValue;

            if (address1) {
                syncNonFormikValue(AUTOCOMPLETE_FIELD_NAME, address1);
            }
        },
        [countries, setFieldValue, syncNonFormikValue],
    );

    const getPlaceholderValue = useCallback(
        (field: FormField, translatedPlaceholderId: string): string => {
            if (field.default && field.fieldType !== 'dropdown') {
                return field.default;
            }

            if (isExtraField(field) && field.fieldType === DynamicFormFieldType.DROPDOWN) {
                return language.translate('common.please_select_text');
            }

            return translatedPlaceholderId && language.translate(translatedPlaceholderId);
        },
        [language],
    );

    return (
        <>
            <Fieldset>
                <div className="checkout-address" ref={containerRef}>
                    {formFields.map((field) => {
                        if (
                            field.hidden ||
                            shouldHideTechHubAddressField(field.name) ||
                            isTechHubField(field, 'deliveryLocation')
                        ) {
                            return null;
                        }

                        const addressFieldName = field.name;
                        const translatedPlaceholderId = PLACEHOLDER[addressFieldName];
                        const getParentFieldName = () => {
                            if (field.custom) {
                                return fieldName ? `${fieldName}.customFields` : 'customFields';
                            }

                            if (isExtraField(field)) {
                                return fieldName ? `${fieldName}.extraFields` : 'extraFields';
                            }

                            return fieldName;
                        };

                        if (
                            addressFieldName === 'address1' &&
                            googleMapsApiKey &&
                            countryCode &&
                            countriesWithAutocomplete.includes(countryCode)
                        ) {
                            return (
                                <GoogleAutocompleteFormField
                                    apiKey={googleMapsApiKey}
                                    countryCode={countryCode}
                                    field={field}
                                    isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                    isNewPlacesApiEnabled={isNewGooglePlacesApiEnabled}
                                    key={field.id}
                                    nextElement={nextElementRef.current || undefined}
                                    onChange={handleAutocompleteChange}
                                    onSelect={handleAutocompleteSelect}
                                    onToggleOpen={onAutocompleteToggle}
                                    parentFieldName={fieldName}
                                    supportedCountries={countriesWithAutocomplete}
                                />
                            );
                        }

                        if (hasAddressLabel && addressFieldName === 'company') {
                            return (
                                <AddressLabelFormField
                                    field={field}
                                    inputId={getAddressFormFieldInputId(addressFieldName)}
                                    isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                    key={`${field.id}-${field.name}`}
                                    onChange={handleDynamicFormFieldChange(field)}
                                    parentFieldName={getParentFieldName()}
                                />
                            );
                        }

                        const renderedField = (
                            <DynamicFormField
                                autocomplete={AUTOCOMPLETE[field.name]}
                                extraClass={`dynamic-form-field--${getAddressFormFieldLegacyName(
                                    addressFieldName,
                                )}`}
                                field={field}
                                inputId={getAddressFormFieldInputId(addressFieldName)}
                                // stateOrProvince can sometimes be a dropdown or input, so relying on id is not sufficient
                                isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                isNewPhoneValidationExperimentEnabled={
                                    isNewPhoneValidationExperimentEnabled
                                }
                                key={`${field.id}-${field.name}`}
                                label={
                                    field.custom || isExtraField(field) ? (
                                        field.label
                                    ) : (
                                        <TranslatedString id={LABEL[field.name]} />
                                    )
                                }
                                onChange={handleDynamicFormFieldChange(field)}
                                parentFieldName={getParentFieldName()}
                                placeholder={getPlaceholderValue(field, translatedPlaceholderId)}
                                selectedCountry={countryCode}
                            />
                        );

                        if (isTechHubField(field, 'departmentCode')) {
                            return (
                                <React.Fragment key={`${field.id}-${field.name}`}>
                                    {renderedField}
                                    <div className="techhub-department-code-lookup">
                                        <p>
                                            Don't know your department code? Click the button below!
                                        </p>
                                        <a
                                            className="button button--primary"
                                            href="https://store-jsj7fos9p1.mybigcommerce.com/content/Department%20Lookup%20Tool/index.html"
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            TAMU DEPARTMENT CODE LOOKUP
                                        </a>
                                    </div>
                                </React.Fragment>
                            );
                        }

                        if (isTechHubField(field, 'collegeUnit') && deliveryLocationField) {
                            const deliveryLocationOptions = deliveryLocations?.map((location) => ({
                                label: location,
                                value: location,
                            }));
                            const deliveryLocationRenderedField =
                                deliveryLocationOptions && deliveryLocationOptions.length ? (
                                    <DynamicFormField
                                        autocomplete="off"
                                        extraClass="dynamic-form-field--delivery-location"
                                        field={{
                                            ...deliveryLocationField,
                                            fieldType: DynamicFormFieldType.DROPDOWN,
                                            options: { items: deliveryLocationOptions },
                                            required: true,
                                        }}
                                        inputId={getAddressFormFieldInputId(
                                            deliveryLocationField.name,
                                        )}
                                        isFloatingLabelEnabled={isFloatingLabelEnabledValue}
                                        label={deliveryLocationField.label}
                                        onChange={handleDynamicFormFieldChange(
                                            deliveryLocationField,
                                        )}
                                        parentFieldName={getParentFieldName()}
                                        placeholder={language.translate('common.please_select_text')}
                                        selectedCountry={countryCode}
                                    />
                                ) : null;

                            return (
                                <React.Fragment key={`${field.id}-${field.name}`}>
                                    {renderedField}
                                    {deliveryLocationsStatus === 'loading' && (
                                        <p className="techhub-delivery-location-loading">
                                            Loading delivery locations…
                                        </p>
                                    )}
                                    {deliveryLocationRenderedField}
                                </React.Fragment>
                            );
                        }

                        return renderedField;
                    })}
                </div>
            </Fieldset>
        </>
    );
};

export default AddressForm;
