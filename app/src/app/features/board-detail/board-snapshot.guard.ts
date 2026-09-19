import type { CanDeactivateFn } from '@angular/router';
import { injectSnapshotCapture } from '@anton-gustafsson/snapshot-angular';
import type { BoardDetailPage } from './board-detail-page/board-detail-page';

/** Captures a thumbnail of the board being left, without blocking navigation. */
export const boardSnapshotGuard: CanDeactivateFn<BoardDetailPage> = (component) => {
  const capture = injectSnapshotCapture();
  void component.captureSnapshot(capture);
  return true;
};
