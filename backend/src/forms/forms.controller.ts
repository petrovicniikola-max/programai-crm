import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormsListQueryDto } from './dto/forms-list-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { SubmitFormDto } from './dto/submit-form.dto';
import { SubmissionsQueryDto } from './dto/submissions-query.dto';
import { PivotQueryDto } from './dto/pivot-query.dto';
import { SendFormLinkDto } from './dto/send-form-link.dto';
import { FormShareService } from './form-share.service';

const ROLES_WRITE = ['SUPER_ADMIN', 'SALES'];
const ROLES_READ = ['SUPER_ADMIN', 'SALES', 'SUPPORT'];

@ApiTags('forms')
@Controller('forms')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class FormsController {
  constructor(
    private readonly forms: FormsService,
    private readonly formShare: FormShareService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Create form (SUPER_ADMIN, SALES)' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateFormDto,
  ) {
    return this.forms.create(tenantId, userId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...ROLES_READ)
  @ApiOperation({ summary: 'List forms (SUPER_ADMIN, SALES, SUPPORT)' })
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: FormsListQueryDto) {
    return this.forms.findAll(tenantId, query);
  }

  @Get(':id/responses/pivot')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_READ)
  @ApiOperation({ summary: 'Responses table/pivot: questions as rows, submissions as columns' })
  getPivot(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query() query: PivotQueryDto,
  ) {
    return this.forms.getPivot(tenantId, id, query);
  }

  @Get(':id/responses.csv')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_READ)
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export responses as CSV (table-like)' })
  async getResponsesCsv(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query() query: PivotQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.forms.getResponsesCsv(tenantId, id, query);
    res.send(csv);
  }

  @Get(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_READ)
  @ApiOperation({ summary: 'List submissions for form' })
  getSubmissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Query() query: SubmissionsQueryDto,
  ) {
    return this.forms.getSubmissions(tenantId, id, query);
  }

  @Post(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Submit form (internal)' })
  @ApiResponse({ status: 201 })
  submit(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string | undefined,
    @Param('id') id: string,
    @Body() dto: SubmitFormDto,
  ) {
    return this.forms.submit(tenantId, id, userId, dto);
  }

  @Post(':id/questions/reorder')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Reorder questions' })
  reorderQuestions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.forms.reorderQuestions(tenantId, id, dto);
  }

  @Post(':id/questions')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Add question' })
  @ApiResponse({ status: 201 })
  createQuestion(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.forms.createQuestion(tenantId, id, dto);
  }

  @Patch(':id/questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Update question' })
  updateQuestion(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.forms.updateQuestion(tenantId, id, questionId, dto);
  }

  @Delete(':id/questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Archive question (soft delete)' })
  archiveQuestion(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.forms.archiveQuestion(tenantId, id, questionId);
  }

  @Post(':id/questions/:questionId/options')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Add option to choice question' })
  @ApiResponse({ status: 201 })
  createOption(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: CreateOptionDto,
  ) {
    return this.forms.createOption(tenantId, id, questionId, dto);
  }

  @Patch(':id/questions/:questionId/options/:optionId')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Update option' })
  updateOption(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Param('optionId') optionId: string,
    @Body() dto: UpdateOptionDto,
  ) {
    return this.forms.updateOption(tenantId, id, questionId, optionId, dto);
  }

  @Delete(':id/questions/:questionId/options/:optionId')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Delete option' })
  deleteOption(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Param('optionId') optionId: string,
  ) {
    return this.forms.deleteOption(tenantId, id, questionId, optionId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_READ)
  @ApiOperation({ summary: 'Get form by id with questions' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.forms.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Update form' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
  ) {
    return this.forms.update(tenantId, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Publish form' })
  publish(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.forms.publish(tenantId, id);
  }

  @Post(':id/unpublish')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Unpublish form' })
  unpublish(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.forms.unpublish(tenantId, id);
  }

  @Post(':id/clone')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Clone form (new DRAFT)' })
  @ApiResponse({ status: 201 })
  clone(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.forms.clone(tenantId, id, userId);
  }

  @Post(':id/send-link')
  @UseGuards(RolesGuard)
  @Roles(...ROLES_WRITE)
  @ApiOperation({ summary: 'Send form link by email. When SMTP not configured, uses Ethereal test inbox; response may include previewUrl.' })
  @ApiResponse({ status: 200 })
  async sendFormLink(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SendFormLinkDto,
  ) {
    const form = await this.forms.findOne(tenantId, id);
    return this.formShare.sendFormLink({
      tenantId,
      formId: id,
      formTitle: form.title,
      toEmail: dto.toEmail.trim().toLowerCase(),
      message: dto.message?.trim(),
    });
  }
}
