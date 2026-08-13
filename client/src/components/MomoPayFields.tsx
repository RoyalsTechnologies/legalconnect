import { Form, Input, Select } from 'antd';

export const MOMO_NETWORK_OPTIONS = [
  { value: 'MTN', label: 'MTN' },
  { value: 'AT', label: 'AirtelTigo' },
  { value: 'TELECEL', label: 'Telecel' },
] as const;

export type MomoNetwork = (typeof MOMO_NETWORK_OPTIONS)[number]['value'];

export type MomoPayValues = {
  phone?: string;
  network?: MomoNetwork;
};

/** Phone and network for a NaloPay mobile-money collection (FR-017). */
export function MomoPayFields() {
  return (
    <>
      <Form.Item
        label="Mobile money number"
        name="phone"
        extra="We send a payment prompt to this number. Ghana numbers only, e.g. 0244123456."
        rules={[{ required: true, message: 'Enter the number you will pay from' }]}
      >
        <Input placeholder="0244123456" inputMode="tel" autoComplete="tel" />
      </Form.Item>
      <Form.Item label="Network" name="network" extra="Leave blank if we can tell from the number.">
        <Select
          allowClear
          placeholder="Usually detected automatically"
          options={[...MOMO_NETWORK_OPTIONS]}
        />
      </Form.Item>
    </>
  );
}
