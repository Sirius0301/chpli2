import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { NoteImagesService } from './note-images.service';

@Module({
  controllers: [NotesController],
  providers: [NotesService, NoteImagesService],
  exports: [NotesService],
})
export class NotesModule {}
