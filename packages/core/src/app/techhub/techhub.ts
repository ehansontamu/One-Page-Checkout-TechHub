import { type FormField } from '@bigcommerce/checkout-sdk';

export const TECHHUB_DEPARTMENT_CODES_URL =
    'https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/TechhubDeptOutputBig.json';

export const TECHHUB_ALLOWED_CHARACTERS = /^[a-zA-Z0-9\-()$,. ]*$/;

const TECHHUB_FIELD_LABELS = {
    accountNumber: 'Recipient Account Number(s) (comma separated)',
    collegeUnit: 'Recipient College/Unit',
    departmentCode: 'Department Code (include system part prefix, e.g. 02-ABCD)',
    recipientUin: 'Recipient UIN(s) or Name(s) (comma separated)',
} as const;

type TechHubField = keyof typeof TECHHUB_FIELD_LABELS;

let departmentCodesPromise: Promise<string[]> | undefined;

function normalizeLabel(label?: string): string {
    return (label || '').replace(/\s+/g, ' ').trim();
}

export function isTechHubField(field: Pick<FormField, 'label'>, name: TechHubField): boolean {
    return normalizeLabel(field.label) === TECHHUB_FIELD_LABELS[name];
}

export function isTechHubRestrictedAddressField(name: string): boolean {
    return ['address1', 'address2', 'city', 'postalCode'].includes(name);
}

export function shouldHideTechHubAddressField(name: string): boolean {
    return ['company', 'phone'].includes(name);
}

export function isTechHubGuestCustomer(customer: unknown): boolean {
    const customerGroup = (customer as { customerGroup?: unknown } | undefined)?.customerGroup;
    const group = Array.isArray(customerGroup) ? customerGroup[0] : customerGroup;
    const groupId = (group as { id?: number | string } | undefined)?.id;

    return String(groupId) === '10';
}

export function loadTechHubDepartmentCodes(): Promise<string[]> {
    if (!departmentCodesPromise) {
        departmentCodesPromise = fetch(TECHHUB_DEPARTMENT_CODES_URL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Unable to load department codes: ${response.status}`);
                }

                return response.json() as Promise<Array<{ 'Full Department Code'?: string }>>;
            })
            .then((departments) =>
                departments
                    .map((department) => department['Full Department Code'])
                    .filter((code): code is string => Boolean(code)),
            )
            .catch((error) => {
                // A later validation can retry if the initial network request was interrupted.
                departmentCodesPromise = undefined;

                throw error;
            });
    }

    return departmentCodesPromise;
}
