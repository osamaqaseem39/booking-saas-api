import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

function makeRepoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { query: jest.fn() },
  };
}

function makeService() {
  const bookingRepo = makeRepoMock();
  const userRepo = makeRepoMock();
  const padelRepo = makeRepoMock();
  const turfRepo = makeRepoMock();
  const tableTennisRepo = makeRepoMock();
  const locationRepo = makeRepoMock();
  const businessRepo = makeRepoMock();
  const slotBlockRepo = makeRepoMock();
  const facilitySlotRepo = makeRepoMock();
  const slotTemplateRepo = makeRepoMock();
  const slotTemplateLineRepo = makeRepoMock();
  const iamService = {
    hasAnyRole: jest.fn(),
    getLocationAdminConstraint: jest.fn(),
  };

  const service = new BookingsService(
    bookingRepo as any,
    userRepo as any,
    padelRepo as any,
    turfRepo as any,
    tableTennisRepo as any,
    locationRepo as any,
    businessRepo as any,
    slotBlockRepo as any,
    facilitySlotRepo as any,
    slotTemplateRepo as any,
    slotTemplateLineRepo as any,
    iamService as any,
  );

  return {
    service,
    repos: {
      bookingRepo,
      userRepo,
      padelRepo,
      turfRepo,
      tableTennisRepo,
      locationRepo,
      businessRepo,
      slotBlockRepo,
      facilitySlotRepo,
      slotTemplateRepo,
      slotTemplateLineRepo,
    },
  };
}

describe('BookingsService - booking wall times', () => {
  it('treats midnight start + end 24:00 as one slot step, not full day', () => {
    const { service } = makeService();
    const effective = (service as any).bookingItemEffectiveEndTime(
      '00:00',
      '24:00',
      60,
    );
    expect(effective).toBe('01:00');
  });

  it('keeps same-day 17:00–24:00 as end-of-day window', () => {
    const { service } = makeService();
    const effective = (service as any).bookingItemEffectiveEndTime(
      '17:00',
      '24:00',
      60,
    );
    expect(effective).toBe('24:00');
  });

  it('maps 17:00–24:00 to next-day midnight end instant', () => {
    const { service } = makeService();
    const { endDatetime } = (service as any).toSlotDateTimes(
      '2026-05-20',
      '17:00',
      '24:00',
    );
    expect(endDatetime.toISOString()).toBe('2026-05-21T00:00:00.000Z');
  });

  it('sync window for 00:00–24:00 item blocks only first hour', () => {
    const { service } = makeService();
    const windows = (service as any).itemFacilitySlotSyncWindows(
      { date: '2026-05-20', startTime: '00:00', endTime: '24:00' },
      '2026-05-20',
      60,
    );
    expect(windows).toEqual([
      {
        slotDate: '2026-05-20',
        windowStart: '00:00',
        windowEnd: '01:00',
      },
    ]);
  });
});

describe('BookingsService - table tennis integration', () => {
  it('returns table-tennis facilities for table-tennis availability queries', async () => {
    const { service, repos } = makeService();

    repos.padelRepo.find.mockResolvedValue([]);
    repos.turfRepo.find.mockResolvedValue([]);
    repos.tableTennisRepo.find.mockResolvedValue([
      {
        id: 'tt-1',
        name: 'TT Court 1',
        tenantId: 'tenant-1',
        pricePerSlot: '1200.00',
      },
    ]);

    (service as any).getCourtSlotGrid = jest.fn().mockResolvedValue({
      segments: [{ startTime: '10:00', endTime: '11:00', state: 'free' }],
    });

    const result = await service.getLocationFacilitiesAvailableSlots({
      locationId: 'loc-1',
      date: '2026-04-29',
      startTime: '10:00',
      endTime: '11:00',
      courtType: 'table-tennis',
    });

    expect(result.facilities).toHaveLength(1);
    expect(result.facilities[0]).toMatchObject({
      kind: 'table_tennis_court',
      courtId: 'tt-1',
      name: 'TT Court 1',
      price: 1200,
    });
  });

  it('rejects booking table_tennis_court when sportType is not table-tennis', async () => {
    const { service, repos } = makeService();

    repos.userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    repos.tableTennisRepo.findOne.mockResolvedValue({
      id: 'tt-1',
      tenantId: 'tenant-1',
      courtStatus: 'active',
      isActive: true,
    });

    await expect(
      service.create('tenant-1', {
        userId: 'user-1',
        sportType: 'padel',
        bookingDate: '2099-01-01',
        items: [
          {
            courtKind: 'table_tennis_court',
            courtId: 'tt-1',
            startTime: '10:00',
            endTime: '11:00',
            price: 1000,
            currency: 'PKR',
            status: 'confirmed',
          },
        ],
        pricing: { subTotal: 1000, discount: 0, tax: 0, totalAmount: 1000 },
        payment: { paymentStatus: 'pending', paymentMethod: 'cash' },
        bookingStatus: 'confirmed',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
