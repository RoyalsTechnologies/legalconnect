import { z } from 'zod';

export const withdrawSchema = z.object({
  amountGhs: z.number().min(1, 'Withdraw at least GH₵ 1').max(50000, 'Withdraw at most GH₵ 50,000'),
});

export type WithdrawInput = z.infer<typeof withdrawSchema>;
