import { Prisma, SeatClass, SeatStatus } from '@prisma/client';

/** Do not copy a sparse demo template onto new instances — use full layout instead. */
export const MIN_SEAT_COUNT_TO_USE_AS_TEMPLATE = 40;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function defaultSeatSpecs(): Array<{ seatNumber: string; class: SeatClass; basePrice: number }> {
  const specs: Array<{ seatNumber: string; class: SeatClass; basePrice: number }> = [];
  for (let row = 1; row <= 14; row += 1) {
    for (const letter of LETTERS) {
      const business = row <= 2;
      specs.push({
        seatNumber: `${row}${letter}`,
        class: business ? SeatClass.BUSINESS : SeatClass.ECONOMY,
        basePrice: business ? 520 : 189,
      });
    }
  }
  return specs;
}

export function defaultSeatRowsForInstance(instanceDbId: string): Prisma.SeatCreateManyInput[] {
  return defaultSeatSpecs().map((s) => ({
    instanceId: instanceDbId,
    seatNumber: s.seatNumber,
    class: s.class,
    basePrice: s.basePrice,
    status: SeatStatus.AVAILABLE,
  }));
}
