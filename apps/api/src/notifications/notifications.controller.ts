import { Body, Controller, Post } from '@nestjs/common';
import { RegisterNotificationDto } from './dto/register-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('register')
  register(@Body() payload: RegisterNotificationDto) {
    return this.notificationsService.registerDevice(payload);
  }
}
