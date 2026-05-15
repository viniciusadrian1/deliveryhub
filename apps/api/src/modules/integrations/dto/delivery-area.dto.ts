import { z } from 'zod';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Criação de área de entrega do 99Food — círculo (raio) ou polígono.
 * A UI hoje só cria círculos; o polígono fica aceito pelo contrato.
 */
export const createDeliveryAreaSchema = z
  .object({
    areaType: z.union([z.literal(0), z.literal(1)]).default(0),
    radiusKm: z.coerce.number().positive().max(50).optional(),
    points: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
    avgDeliveryEtaSeconds: z.coerce.number().int().min(60).max(7200),
    enableTimes: z
      .array(
        z.object({
          start: z.string().regex(TIME),
          end: z.string().regex(TIME),
        }),
      )
      .min(1)
      .max(10),
    priceCents: z.coerce.number().int().min(0).max(1_000_000),
  })
  .refine(
    (d) => (d.areaType === 0 ? d.radiusKm != null : (d.points?.length ?? 0) >= 3),
    { message: 'circle_requires_radius_or_polygon_requires_3_points' },
  );

export type CreateDeliveryAreaInput = z.infer<typeof createDeliveryAreaSchema>;

export const deleteDeliveryAreaSchema = z.object({
  areaIds: z.array(z.string().regex(/^\d+$/)).min(1).max(50),
});

export type DeleteDeliveryAreaInput = z.infer<typeof deleteDeliveryAreaSchema>;
