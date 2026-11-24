WUNDOU Work Report Generator v2.1.0

Chrome extension for managing WUNDOU tasks and generating dated Bibek/Nurbu reports.

Changes in 2.1.0
- Removed Start %.
- Renamed End % to Status %.
- Existing End % values automatically migrate to Status %.
- Tasks remain in one unified list with Bibek/Nurbu Assignee selection.
- Report tab now provides two separate reports:
  1. Evening report using today's Japan date.
  2. Next morning report using tomorrow's Japan date.
- Both reports automatically group tasks into BIBEK and NURBU blocks.
- The same Status % is used in the evening report and as the next morning's starting status.
- WUNDOU task names remain linked to Backlog.
- Private Note remains available in Tasks and is not included in reports.

Current workflow
- Backlog project prefix: WUNDOU
- Backlog URLs: https://maruori.backlog.com/view/WUNDOU-67
- Tabs: Tasks / Report
- Task fields: Assignee, WUNDOU ID, Task name, Status %, private Note
- Report dates are calculated using Asia/Tokyo.

Install / update
1. Extract this folder somewhere permanent.
2. Open chrome://extensions/.
3. Enable Developer mode.
4. If already installed, replace the old extension files with these files and click Reload.
   If installing fresh, click Load unpacked and select this folder.
