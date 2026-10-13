import { z } from 'zod';

const scopeType = z.enum(['church', 'congregation', 'ministry', 'cell']);
// IDs são UUID no banco (validados lá); aqui só exigimos presença para que o
// modo demonstração, com IDs legíveis, use as mesmas regras.
const entityId = z.string().min(1);

export const audienceSchema = z
  .object({ type: scopeType, id: entityId.nullable() })
  .refine((a) => (a.type === 'church') === (a.id === null), 'Público inválido');

export const announcementInputSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(140, 'Máximo de 140 caracteres'),
  body: z.string().trim().min(1, 'Escreva o conteúdo').max(5000, 'Máximo de 5000 caracteres'),
  audiences: z.array(audienceSchema).min(1, 'Selecione ao menos um público'),
  publishNow: z.boolean(),
});
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(140),
    description: z.string().trim().max(5000).default(''),
    locationLabel: z.string().trim().max(200).default(''),
    startsAt: z.string().min(1, 'Informe data e hora'),
    endsAt: z.string().optional().nullable(),
    capacity: z.coerce.number().int().positive().nullable().optional(),
    registrationEnabled: z.boolean(),
    audience: audienceSchema,
  })
  .refine((e) => !e.endsAt || new Date(e.endsAt) > new Date(e.startsAt), {
    message: 'O término deve ser após o início',
    path: ['endsAt'],
  });
export type EventInput = z.infer<typeof eventInputSchema>;

export const scheduleInputSchema = z.object({
  ministryId: entityId,
  title: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(120),
  startsAt: z.string().min(1, 'Informe data e hora'),
  notes: z.string().trim().max(2000).default(''),
});
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const cellInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  regionLabel: z.string().trim().max(80).default(''),
  meetingWeekday: z.coerce.number().int().min(0).max(6).nullable(),
  meetingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido').nullable(),
  description: z.string().trim().max(1000).default(''),
});
export type CellInput = z.infer<typeof cellInputSchema>;

export const profileInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome').max(120),
  displayName: z.string().trim().max(60).nullable(),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9()+\-\s]*$/, 'Telefone inválido')
    .nullable(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
});
