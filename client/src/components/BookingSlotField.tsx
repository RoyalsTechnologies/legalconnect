import { Form, Input } from 'antd';

function localMin(): string {
  const start = new Date(Date.now() + 15 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

/** Native datetime so we do not add a date-picker library for one field. */
export function BookingSlotField() {
  return (
    <Form.Item
      label="When should this consultation happen?"
      name="scheduledAt"
      extra="Use the time on this device. After the lawyer accepts, you can add it to Google Calendar and join on Google Meet."
      rules={[{ required: true, message: 'Choose a date and time' }]}
    >
      <Input type="datetime-local" min={localMin()} />
    </Form.Item>
  );
}

export function toScheduledIso(localValue: string): string {
  return new Date(localValue).toISOString();
}
