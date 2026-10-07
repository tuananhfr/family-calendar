import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/http/current-session.decorator';
import type { AppConfig } from '../../config/configuration';

export class MetaChannelsDto {
  @ApiProperty() in_app: boolean;
  @ApiProperty({ description: 'False when the server has no VAPID keys.' }) push: boolean;
  @ApiProperty() email: boolean;
  @ApiProperty({ description: 'No SMS provider in v1.' }) sms: boolean;
}

export class MetaFeaturesDto {
  @ApiProperty({ description: 'An AI provider key is configured on the server.' }) ai: boolean;
}

export class MetaDto {
  @ApiProperty({ enum: ['v1'] }) api_version: 'v1';
  @ApiProperty({ nullable: true, type: String }) vapid_public_key: string | null;
  @ApiProperty({ type: MetaChannelsDto }) channels: MetaChannelsDto;
  @ApiProperty({ type: MetaFeaturesDto }) features: MetaFeaturesDto;
}

@ApiTags('system')
@Public()
@Controller('meta')
export class MetaController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Get()
  @ApiOkResponse({ type: MetaDto })
  meta(): MetaDto {
    const vapid = this.config.get('vapid', { infer: true });
    const pushReady = Boolean(vapid.publicKey && vapid.privateKey);
    return {
      api_version: 'v1',
      vapid_public_key: pushReady ? vapid.publicKey : null,
      channels: { in_app: true, push: pushReady, email: true, sms: false },
      features: { ai: Boolean(this.config.get('ai', { infer: true }).apiKey) },
    };
  }
}
