import { PrismaService } from '../../prisma/prisma.service';
import { activeUsersLastDaysTemplate } from './active-users-last-days';
import { activeLicencesLastDaysTemplate } from './active-licences-last-days';
import {
  companiesNoTicketsInDaysTemplate,
  topCompaniesByActiveDevicesTemplate,
} from './companies.templates';
import { compareDistributorEmailsToCompaniesTemplate } from './compare-distributor-emails-to-companies';
import {
  activeDevicesWithoutLicenceTemplate,
  licencesExpiringSoonByCompanyTemplate,
  newDevicesByDistributorTemplate,
} from './licences-devices.templates';
import { leaveApprovedInMonthTemplate, leaveLowAnnualBalanceTemplate } from './leave.templates';
import { projectTimeMonthlyByUserAndProjectTemplate } from './project-time-monthly-by-user-and-project';
import {
  projectTimeMissingEntriesTemplate,
  projectTimeProjectMonthlyByUserTemplate,
  projectTimeProjectsOverHoursTemplate,
  projectTimeQuarterlyByUserAndProjectTemplate,
  projectTimeWeeklyByUserAndProjectTemplate,
} from './project-time-extra.templates';
import { projectTimePerProjectTemplate } from './project-time-per-project';
import { projectTimeUserAllProjectsTemplate } from './project-time-user-all-projects';
import { projectTimeUserOnProjectTemplate } from './project-time-user-on-project';
import { projectTimeWorkOrdersExportTemplate } from './project-time-work-orders-export';
import {
  salesDirectoryWithoutCompanyMatchTemplate,
  salesDirectoryWithoutEmailTemplate,
} from './sales-extra.templates';
import {
  ticketsByTypeInPeriodTemplate,
  ticketsOpenByAssigneeTemplate,
  ticketsStaleOpenTemplate,
} from './tickets.templates';
import { topDistributorsActiveLicencesTemplate } from './top-distributors-active-licences';
import { lostLicencesByDistributorTemplate } from './lost-licences-by-distributor';
import { ReportTemplate } from './types';

export function buildTemplates(prisma: PrismaService): ReportTemplate[] {
  return [
    topDistributorsActiveLicencesTemplate(prisma),
    lostLicencesByDistributorTemplate(prisma),
    activeLicencesLastDaysTemplate(prisma),
    activeUsersLastDaysTemplate(prisma),
    compareDistributorEmailsToCompaniesTemplate(prisma),
    projectTimeMonthlyByUserAndProjectTemplate(prisma),
    projectTimeQuarterlyByUserAndProjectTemplate(prisma),
    projectTimeProjectMonthlyByUserTemplate(prisma),
    projectTimeMissingEntriesTemplate(prisma),
    projectTimeProjectsOverHoursTemplate(prisma),
    projectTimeWeeklyByUserAndProjectTemplate(prisma),
    projectTimePerProjectTemplate(prisma),
    projectTimeUserAllProjectsTemplate(prisma),
    projectTimeUserOnProjectTemplate(prisma),
    projectTimeWorkOrdersExportTemplate(prisma),
    ticketsOpenByAssigneeTemplate(prisma),
    ticketsStaleOpenTemplate(prisma),
    ticketsByTypeInPeriodTemplate(prisma),
    licencesExpiringSoonByCompanyTemplate(prisma),
    activeDevicesWithoutLicenceTemplate(prisma),
    newDevicesByDistributorTemplate(prisma),
    salesDirectoryWithoutCompanyMatchTemplate(prisma),
    salesDirectoryWithoutEmailTemplate(prisma),
    leaveApprovedInMonthTemplate(prisma),
    leaveLowAnnualBalanceTemplate(prisma),
    companiesNoTicketsInDaysTemplate(prisma),
    topCompaniesByActiveDevicesTemplate(prisma),
  ];
}

export function templateByKey(
  templates: ReportTemplate[],
  key: string,
): ReportTemplate | undefined {
  return templates.find((t) => t.key === key);
}
