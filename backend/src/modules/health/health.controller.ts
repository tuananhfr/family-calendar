import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { Public } from '../../common/http/current-session.decorator';

export class HealthDto {
  @ApiProperty({ enum: ['ok'] }) status: 'ok';
  @ApiProperty({ enum: ['ok'] }) db: 'ok';
}

@ApiTags('system')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<HealthDto> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ApiError(ErrorCode.TEMPORARILY_UNAVAILABLE, 503);
    }
    return { status: 'ok', db: 'ok' };
  }
}
