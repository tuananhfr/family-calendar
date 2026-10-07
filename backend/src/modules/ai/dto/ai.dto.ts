import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsClientId } from '../../../common/ids';
import { AUTOMATION_RULES } from '../../sync/domain-enums';
import { AUTOMATION_RUN_STATUSES } from '../entities/automation-run.entity';
import type { AiDraft } from '../tools';

export class AiConsentRequestDto {
  @ApiProperty({ description: 'true agrees (or updates the health choice); false withdraws the consent.' })
  @IsBoolean()
  accepted: boolean;

  @ApiProperty({ description: 'Include health/SENSITIVE items in what is sent to the assistant. Default off.' })
  @IsBoolean()
  allow_health: boolean;
}

export class AiConsentDto {
  @ApiProperty() accepted: boolean;
  @ApiProperty() allow_health: boolean;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) accepted_at: string | null;
  @ApiProperty({ description: 'Consent text version the user agreed to.' }) version: string;
}

export class AiStatusDto {
  @ApiProperty({ description: 'False: no provider is configured on the server ("Chưa cấu hình trợ lý").' })
  configured: boolean;
  @ApiProperty({ type: AiConsentDto, nullable: true, description: "The caller's consent in this Space, if any." })
  consent: AiConsentDto | null;
}

export class AiMessageRequestDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit to start a new conversation (the server picks the id).' })
  @IsOptional()
  @IsClientId()
  conversation_id?: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}

export class AiDraftDto {
  @ApiProperty({
    enum: ['ITEM', 'TIMETABLE', 'SUMMARY'],
    description:
      'ITEM: kind, preset, title, date (YYYY-MM-DD), time/end_time (HH:mm or null = no time chosen), all_day, ' +
      'category, member_id (resolved from member_name, or null), member_name, note. ' +
      'TIMETABLE: member_id, member_name, entries[{weekday 1=Mon…7=Sun, start, end, subject, room}]. ' +
      'SUMMARY: from, to, summary. Drafts are never saved by the server.',
  })
  type: 'ITEM' | 'TIMETABLE' | 'SUMMARY';
}

export class AiMessageResponseDto {
  @ApiProperty({ format: 'uuid' }) conversation_id: string;
  @ApiProperty() reply: string;
  @ApiProperty({ type: [AiDraftDto] }) drafts: AiDraft[];
}

export class AiConversationSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ description: 'Start of the first question (≤ 80 characters); only its author can list it.' })
  preview: string;
  @ApiProperty() message_count: number;
  @ApiProperty({ format: 'date-time' }) created_at: string;
  @ApiProperty({ format: 'date-time' }) updated_at: string;
}

export class AiConversationListDto {
  @ApiProperty({ type: [AiConversationSummaryDto], description: 'Newest first, at most 50.' })
  conversations: AiConversationSummaryDto[];
}

export class AiConversationMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] }) role: 'user' | 'assistant';
  @ApiProperty() text: string;
  @ApiProperty({ type: [AiDraftDto] }) drafts: AiDraft[];
  @ApiProperty({ format: 'date-time' }) created_at: string;
}

export class AiConversationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: [AiConversationMessageDto] }) messages: AiConversationMessageDto[];
}

export class AutomationRunDto {
  @ApiProperty() id: string;
  @ApiProperty({ format: 'uuid' }) automation_id: string;
  @ApiProperty({ enum: AUTOMATION_RULES }) rule_key: string;
  @ApiProperty({ enum: AUTOMATION_RUN_STATUSES }) status: string;
  @ApiProperty({ description: 'Notifications sent or tasks created by this run.' }) result_count: number;
  @ApiProperty({ format: 'date-time' }) ran_at: string;
}

export class AutomationRunListDto {
  @ApiProperty({ type: [AutomationRunDto], description: 'Newest first, at most 50.' })
  runs: AutomationRunDto[];
}
