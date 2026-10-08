import { Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { MediaService, type MediaKind } from './media.service';
class MediaInfoDto {
  @ApiProperty() size: number;
  @ApiProperty() mime: string;
  @ApiProperty() sha256: string;
}
class MediaStoredDto { @ApiProperty() stored: boolean; }
@ApiTags('storage')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/media/:kind/:recordId/:assetId')
export class MediaController {
  constructor(private readonly media: MediaService) {}
  @Get('info') @ApiOkResponse({ type: MediaInfoDto })
  info(@CurrentSession() session: SessionContext, @Param('id') id: string, @Param('kind') kind: MediaKind, @Param('recordId') recordId: string, @Param('assetId') assetId: string) {
    return this.media.info(session, id, kind, recordId, assetId);
  }
  @Post() @ApiConsumes('application/octet-stream') @ApiCreatedResponse({ type: MediaStoredDto })
  upload(@CurrentSession() session: SessionContext, @Param('id') id: string, @Param('kind') kind: MediaKind, @Param('recordId') recordId: string, @Param('assetId') assetId: string, @Req() req: Request) {
    return this.media.upload(session, id, kind, recordId, assetId, req, req.get('Content-Type') ?? '', req.get('X-Content-SHA256') ?? '');
  }
  @Get() @ApiOkResponse({ description: 'Authorized, decrypted bytes; private no-store.' })
  async download(@CurrentSession() session: SessionContext, @Param('id') id: string, @Param('kind') kind: MediaKind, @Param('recordId') recordId: string, @Param('assetId') assetId: string, @Res() res: Response) {
    const result = await this.media.open(session, id, kind, recordId, assetId);
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', result.mime);
    res.setHeader('Content-Length', result.bytes.length); res.send(result.bytes);
  }
}
