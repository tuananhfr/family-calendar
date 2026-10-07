import { Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { BlobService } from './blob.service';

export class BlobStoredDto {
  @ApiProperty({ enum: ['SYNCED'] }) blob_state: 'SYNCED';
}

/** RFC 6266: ASCII fallback plus the exact UTF-8 name, so Vietnamese file names survive the download. */
function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

@ApiTags('storage')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/files/:fileId/blob')
export class BlobController {
  constructor(private readonly blobs: BlobService) {}

  @Post()
  @HttpCode(201)
  @ApiConsumes('application/octet-stream')
  @ApiHeader({ name: 'X-Content-SHA256', required: true, description: 'Lowercase hex SHA-256 of the raw body.' })
  @ApiCreatedResponse({
    type: BlobStoredDto,
    description:
      'Raw body (any Content-Type). Needs storage EDIT on the file. 422 fields.sha256 INVALID|MISMATCH or fields.size ' +
      'MISMATCH (must equal the file record); 413 above the per-kind cap; 404 if the file is not in this Space.',
  })
  upload(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
  ): Promise<BlobStoredDto> {
    const length = req.get('content-length');
    return this.blobs.upload(session, spaceId, fileId, req, {
      sha256: req.get('x-content-sha256'),
      contentLength: length === undefined ? undefined : Number(length),
    });
  }

  @Get()
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description:
      'Decrypted bytes as an attachment, Cache-Control private, no-store. 500 BLOB_CORRUPT if the stored copy fails authentication.',
  })
  async download(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const blob = await this.blobs.open(session, spaceId, fileId);
    res.status(200);
    res.setHeader('Content-Type', blob.contentType);
    res.setHeader('Content-Length', String(blob.size));
    res.setHeader('Content-Disposition', contentDisposition(blob.name));
    res.setHeader('Cache-Control', 'private, no-store');
    pipeline(blob.stream(), res, (err) => {
      void blob.close();
      if (err) res.destroy();
    });
  }
}
