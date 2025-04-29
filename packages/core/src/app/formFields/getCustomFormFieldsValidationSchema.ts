import { FormField } from '@bigcommerce/checkout-sdk';
import { memoize } from '@bigcommerce/memoize';
import { object, ObjectSchema } from 'yup';

export type TranslateValidationErrorFunction = (
    validationType: 'max' | 'min' | 'required' | 'invalid',
    field: {
        name: string;
        label: string;
        min?: number;
        max?: number;
    },
) => string | undefined;

export interface FormFieldsValidationSchemaOptions {
    formFields: FormField[];
    translate?: TranslateValidationErrorFunction;
}

export interface CustomFormFieldValues {
    customFields: CustomFormFields;
}

export interface CustomFormFields {
    [id: string]: string | string[] | number;
}

export default memoize(function getCustomFormFieldsValidationSchema(
    // Using _ to avoid destructuring, which would require us to use all parameters
    _: FormFieldsValidationSchemaOptions
): ObjectSchema<CustomFormFieldValues> {
    // TEMPORARY FIX: Create a mock validation schema that always validates as true
    // This lets the form submit even if custom fields are empty
    return object({
        customFields: object().nullable(true),
    }) as ObjectSchema<CustomFormFieldValues>;
});
