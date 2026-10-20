import { type ObjectSchema, type ValidationError } from 'yup';

import { getFormFields } from '../address/formField.mock';
import { getShippingAddress } from '../shipping/shipping-addresses.mock';

import getCustomFormFieldsValidationSchema, {
    type CustomFormFieldValues,
    type TranslateValidationErrorFunction,
} from './getCustomFormFieldsValidationSchema';
import getFormFieldsValidationSchema, {
    type FormFieldValues,
} from './getFormFieldsValidationSchema';

describe('getCustomFormFieldsValidationSchema', () => {
    const formFields = getFormFields();
    let translate: TranslateValidationErrorFunction;

    beforeEach(() => {
        translate = jest.fn();
    });

    describe('when enforce validate safe input', () => {
        let schema: ObjectSchema<Partial<FormFieldValues>>;

        beforeEach(() => {
            schema = getFormFieldsValidationSchema({
                formFields,
                translate,
            });
        });

        it('throws if invalid characters are present', async () => {
            const errors = await schema
                .validate({
                    ...getShippingAddress(),
                    firstName: 'Luis<>',
                })
                .catch((error: ValidationError) => error.message);

            expect(errors).toBe('firstName must match the following: "/^[^<>]*$/"');
        });

        it('does not throw if valid characters are present', async () => {
            expect(
                await schema.isValid({
                    ...getShippingAddress(),
                    firstName: "Luis{}:;()`/-'",
                }),
            ).toBeTruthy();
        });
    });

    describe.each(['field_52', 'field_999'])('TechHub recipient UIN field %s', (name) => {
        let schema: ObjectSchema<CustomFormFieldValues>;

        beforeEach(() => {
            schema = getCustomFormFieldsValidationSchema({
                formFields: [
                    {
                        custom: true,
                        default: '',
                        fieldType: 'multiline',
                        id: name,
                        label: 'Recipient UIN(s) or Name(s) (comma separated)',
                        name,
                        required: true,
                        type: 'string',
                    },
                ],
            });
        });

        it('accepts exactly 250 characters, including commas and spaces', async () => {
            const value = '123456789, '.repeat(22) + 'Jane Doe';

            expect(value.length).toBe(250);
            expect(await schema.isValid({ customFields: { [name]: value } })).toBe(true);
        });

        it.each([
            ['251 characters', '1'.repeat(251)],
            ['250 characters plus a leading space', ` ${'1'.repeat(250)}`],
            ['250 characters plus a trailing space', `${'1'.repeat(250)} `],
        ])(
            'rejects %s',
            async (_description, value) => {
                await expect(schema.validate({ customFields: { [name]: value } })).rejects.toThrow(
                    'Recipient UIN(s) or Name(s) must be 250 characters or fewer',
                );
            },
        );

        it('continues to reject blank values', async () => {
            await expect(schema.validate({ customFields: { [name]: ' ' } })).rejects.toThrow(
                'Recipient UIN(s) or Name(s) cannot be blank',
            );
        });

        it('continues to reject invalid characters', async () => {
            await expect(schema.validate({ customFields: { [name]: 'Jane<>Doe' } })).rejects.toThrow(
                'Recipient UIN(s) or Name(s) contains invalid characters',
            );
        });
    });

    describe('when custom integer field is present', () => {
        let schema: ObjectSchema<CustomFormFieldValues>;

        beforeEach(() => {
            schema = getCustomFormFieldsValidationSchema({
                formFields: [
                    ...formFields,
                    {
                        custom: true,
                        min: 3,
                        max: 5,
                        fieldType: 'text',
                        id: 'field_100',
                        name: 'field_100',
                        required: false,
                        type: 'integer',
                    } as any,
                ],
                translate,
            });
        });

        it('throws if min validation fails', async () => {
            const errors = await schema
                .validate({
                    ...getShippingAddress(),
                    customFields: {
                        field_100: 2,
                    },
                })
                .catch((error: ValidationError) => error.message);

            expect(errors).toBe('customFields.field_100 must be greater than or equal to 3');
        });

        it('throws if max validation fails', async () => {
            const errors = await schema
                .validate({
                    ...getShippingAddress(),
                    customFields: {
                        field_100: 6,
                    },
                })
                .catch((error: ValidationError) => error.message);

            expect(errors).toBe('customFields.field_100 must be less than or equal to 5');
        });

        it('resolves if min/max validation pass', async () => {
            const spy = jest.fn();

            await schema
                .validate({
                    ...getShippingAddress(),
                    customFields: {
                        field_100: 4,
                    },
                })
                .then(spy);

            expect(spy).toHaveBeenCalled();
        });
    });

    describe('when custom radio field is present', () => {
        let schema: ObjectSchema<CustomFormFieldValues>;

        beforeEach(() => {
            schema = getCustomFormFieldsValidationSchema({
                formFields: [
                    ...formFields,
                    {
                        options: { items: [{ value: 'x' }, { value: 'y' }] },
                        fieldType: 'dropdown',
                        id: 'field_100',
                        name: 'field_100',
                        required: true,
                        type: 'string',
                        custom: true,
                    } as any,
                ],
                translate,
            });
        });

        it('throws if value empty', async () => {
            const errors = await schema
                .validate({
                    ...getShippingAddress(),
                    customFields: {
                        field_100: '',
                    },
                })
                .catch((error: ValidationError) => error.message);

            expect(errors).toBe('customFields.field_100 is a required field');
        });

        it('resolves if valid value', async () => {
            const spy = jest.fn();

            await schema
                .validate({
                    ...getShippingAddress(),
                    customFields: {
                        field_100: 'x',
                    },
                })
                .then(spy);

            expect(spy).toHaveBeenCalled();
        });
    });
});
