import { Address, AddressKey, FormField } from '@bigcommerce/checkout-sdk';

import { DynamicFormFieldType } from '../ui/form';

export type AddressFormValues = Pick<Address, Exclude<AddressKey, 'customFields'>> & {
    customFields: { [id: string]: any };
};

export default function mapAddressToFormValues(
    fields: FormField[],
    address?: Address,
): AddressFormValues {
    const values = {
        ...fields.reduce(
            (addressFormValues, { name, custom, fieldType, default: defaultValue }) => {
                if (custom) {
                    if (!addressFormValues.customFields) {
                        addressFormValues.customFields = {};
                    }

                    // Initialize custom fields with empty values regardless of what might be in the address object
                    // This forces users to enter this information every time
                    if (fieldType === DynamicFormFieldType.checkbox) {
                        addressFormValues.customFields[name] = [];
                    } else if (fieldType === DynamicFormFieldType.date) {
                        // For date fields, use a default value if one is provided in the field config
                        addressFormValues.customFields[name] = defaultValue ? 
                            getDefaultValue(fieldType, defaultValue) : '';
                    } else if (fieldType === DynamicFormFieldType.dropdown && defaultValue) {
                        // For dropdown fields, use the default value if available
                        addressFormValues.customFields[name] = defaultValue;
                    } else {
                        // For all other fields, use empty string
                        addressFormValues.customFields[name] = '';
                    }

                    return addressFormValues;
                }

                if (isSystemAddressFieldName(name)) {
                    const fieldValue = address && address[name];

                    addressFormValues[name] = getValue(
                        fieldType,
                        fieldValue,
                        defaultValue,
                    )?.toString() || '';
                }

                return addressFormValues;
            },
            {} as AddressFormValues,
        ),
    };

    values.shouldSaveAddress =
        address && address.shouldSaveAddress !== undefined ? address.shouldSaveAddress : true;

    // Manually backfill stateOrProvince to avoid Formik warning (uncontrolled to controlled input)
    if (values.stateOrProvince === undefined) {
        values.stateOrProvince = '';
    }

    if (values.stateOrProvinceCode === undefined) {
        values.stateOrProvinceCode = '';
    }

    return values;
}

function getValue(
    fieldType?: string,
    fieldValue?: string | string[] | number,
    defaultValue?: string,
): string | string[] | number | Date | undefined {
    if (fieldValue === undefined || fieldValue === null) {
        return getDefaultValue(fieldType, defaultValue);
    }

    if (fieldType === DynamicFormFieldType.date && typeof fieldValue === 'string') {
        if (fieldValue) {
            const [year, month, day] = fieldValue.split('-');

            return new Date(Number(year), Number(month)-1, Number(day));
        }

        return undefined;
    }

    return fieldValue;
}

function getDefaultValue(fieldType?: string, defaultValue?: string): string | string[] | Date {
    if (defaultValue && fieldType === DynamicFormFieldType.date) {
        return new Date(defaultValue);
    }

    if (fieldType === DynamicFormFieldType.checkbox) {
        return [];
    }

    return defaultValue || '';
}

function isSystemAddressFieldName(
    fieldName: string,
): fieldName is Exclude<keyof Address, 'customFields' | 'shouldSaveAddress'> {
    return fieldName !== 'customFields' && fieldName !== 'shouldSaveAddress';
}
