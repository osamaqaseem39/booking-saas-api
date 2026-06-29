import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitScoreDto } from './match-ops.dto';

const PIPE_OPTS = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe('SubmitScoreDto', () => {
  it('accepts padel set detail', async () => {
    const dto = plainToInstance(SubmitScoreDto, {
      homeScore: 1,
      awayScore: 0,
      sets: [{ home: 6, away: 4 }],
    });
    const errors = await validate(dto, PIPE_OPTS);
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown properties', async () => {
    const dto = plainToInstance(SubmitScoreDto, {
      homeScore: 1,
      awayScore: 0,
      unknown: true,
    });
    const errors = await validate(dto, PIPE_OPTS);
    expect(errors.some((e) => e.property === 'unknown')).toBe(true);
  });
});
