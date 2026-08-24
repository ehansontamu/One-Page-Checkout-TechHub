import { type FormField } from '@bigcommerce/checkout-sdk';

export const TECHHUB_DEPARTMENT_CODES_URL =
    'https://store-jsj7fos9p1.mybigcommerce.com/content/JSON%20Files/TechhubDeptOutputBig.json';

// The production WebDAV URL will be supplied before this feature is deployed. Keeping the
// development URL separate means the external data is never bundled with checkout-js.
export const TECHHUB_DELIVERY_LOCATIONS_URL =
    process.env.NODE_ENV === 'development'
        ? 'http://127.0.0.1:8080/checkout_address_whitelist.json'
        : '';

export const TECHHUB_ALLOWED_CHARACTERS = /^[a-zA-Z0-9\-()$,. ]*$/;

const TECHHUB_FIELD_LABELS = {
    accountNumber: 'Recipient Account Number(s) (comma separated)',
    collegeUnit: 'Recipient College/Unit',
    departmentCode: 'Department Code (include system part prefix, e.g. 02-ABCD)',
    deliveryLocation: 'Delivery Location',
    recipientUin: 'Recipient UIN(s) or Name(s) (comma separated)',
} as const;

type TechHubField = keyof typeof TECHHUB_FIELD_LABELS;

let departmentCodesPromise: Promise<string[]> | undefined;
let departmentCodes: string[] | undefined;
let didFailToLoadDepartmentCodes = false;
let deliveryLocationsPromise: Promise<TechHubDeliveryLocations> | undefined;
let deliveryLocations: TechHubDeliveryLocations | undefined;

interface TechHubDeliveryLocationEntry {
    building?: string;
    room?: string;
}

type TechHubDeliveryLocations = Map<string, string[]>;

function normalizeLabel(label?: string): string {
    return (label || '').replace(/\s+/g, ' ').trim();
}

function getDeliveryLocationLabel({ building, room }: TechHubDeliveryLocationEntry): string {
    return [building, room].map((value) => normalizeLabel(value)).filter(Boolean).join(' — ');
}

export function isTechHubField(field: Pick<FormField, 'label'>, name: TechHubField): boolean {
    return normalizeLabel(field.label) === TECHHUB_FIELD_LABELS[name];
}

export function getTechHubFieldOptionLabel(field: FormField, value?: string): string {
    if (!value) {
        return '';
    }

    return field.options?.items?.find((option) => option.value === value)?.label || value;
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
            .then((departments) => {
                departmentCodes = departments
                    .map((department) => department['Full Department Code'])
                    .filter((code): code is string => Boolean(code));

                return departmentCodes;
            })
            .catch((error) => {
                // A later validation can retry if the initial network request was interrupted.
                departmentCodesPromise = undefined;
                didFailToLoadDepartmentCodes = true;

                throw error;
            });
    }

    return departmentCodesPromise;
}

export function loadTechHubDeliveryLocations(): Promise<TechHubDeliveryLocations> {
    if (!TECHHUB_DELIVERY_LOCATIONS_URL) {
        return Promise.reject(new Error('A TechHub delivery-locations URL has not been configured'));
    }

    if (!deliveryLocationsPromise) {
        deliveryLocationsPromise = fetch(TECHHUB_DELIVERY_LOCATIONS_URL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Unable to load delivery locations: ${response.status}`);
                }

                return response.json() as Promise<Record<string, TechHubDeliveryLocationEntry[]>>;
            })
            .then((locationsByCollege) => {
                deliveryLocations = new Map(
                    Object.entries(locationsByCollege).map(([college, locations]) => [
                        normalizeLabel(college),
                        Array.from(
                            new Set(
                                locations
                                    .map(getDeliveryLocationLabel)
                                    .filter((location): location is string => Boolean(location)),
                            ),
                        ),
                    ]),
                );

                return deliveryLocations;
            })
            .catch((error) => {
                // The delivery-location field is optional when its external data is unavailable.
                // Clear the failed promise so a later checkout visit can retry the request.
                deliveryLocationsPromise = undefined;

                throw error;
            });
    }

    return deliveryLocationsPromise;
}

export function getTechHubDeliveryLocations(collegeUnit?: string): string[] | undefined {
    if (!deliveryLocations) {
        return undefined;
    }

    return deliveryLocations.get(normalizeLabel(collegeUnit)) || [];
}

export function isTechHubDeliveryLocationRequired(collegeUnit?: string): boolean {
    return Boolean(getTechHubDeliveryLocations(collegeUnit)?.length);
}

export function isTechHubDepartmentCodeValid(code?: string): boolean {
    if (!code) {
        return false;
    }

    // Formik validates synchronously during checkout startup. Permit the initial pass while
    // the list is loading, then SingleShippingForm revalidates as soon as it is available.
    if (!departmentCodes) {
        return !didFailToLoadDepartmentCodes;
    }

    return departmentCodes.includes(code);
}
