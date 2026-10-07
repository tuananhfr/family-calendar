import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from '../../integrations/entities/integration.entity';

export class CreateIcsFeedDto {
  @ApiPropertyOptional({ maxLength: 50, description: 'Where the link is used, e.g. "Google Calendar của bố".' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional({ description: 'Show names of CHILD members in event descriptions. Default false.' })
  @IsOptional()
  @IsBoolean()
  include_child_names?: boolean;
}

export class IcsFeedDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true, type: String }) label: string | null;
  @ApiProperty() include_child_names: boolean;
  @ApiProperty({ format: 'date-time' }) created_at: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String, description: 'Last time a calendar fetched it.' })
  last_used_at: string | null;
}

export class IcsFeedCreatedDto extends IcsFeedDto {
  @ApiProperty({
    description: 'Subscription URL with the secret token. Shown only now: the server keeps just a hash of it.',
  })
  url: string;
}

export const INTEGRATION_STATUSES = ['NOT_CONFIGURED', 'AVAILABLE', 'CONNECTED', 'ERROR'] as const;

export class IntegrationStatusDto {
  @ApiProperty({ enum: INTEGRATION_PROVIDERS }) provider: IntegrationProvider;
  @ApiProperty({
    enum: INTEGRATION_STATUSES,
    description: 'V1: OPEN_API is AVAILABLE through the ICS link; every other provider is NOT_CONFIGURED.',
  })
  status: (typeof INTEGRATION_STATUSES)[number];
  @ApiProperty({ description: 'False in V1: there is no connect flow yet.' }) can_connect: boolean;
  @ApiProperty({ description: 'Vietnamese explanation shown on the card.' }) message: string;
}

export class IntegrationsDto {
  @ApiProperty({ type: [IntegrationStatusDto] }) integrations: IntegrationStatusDto[];
  @ApiProperty({ description: 'Caller has `backup` EDIT: may create and revoke ICS links.' }) can_manage_ics: boolean;
  @ApiProperty({ type: [IcsFeedDto], description: 'Active ICS links (empty unless can_manage_ics).' })
  ics_feeds: IcsFeedDto[];
}
