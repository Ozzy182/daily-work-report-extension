Daily Work Report Generator v1.5.2

Private Chrome extension for creating daily Japanese morning/evening Slack reports.

Changes in 1.5.2
- Morning report date is automatically set to the next Japan calendar day (+1 day), because it is prepared/scheduled the previous evening.
- Evening report date continues to use the current Japan date.

Previous behavior retained
- Morning report: completed tasks are automatically omitted.
- Morning report: all non-completed tasks are shown once with Current % and Target %.
- Evening report: every task is shown under 今日の作業 with Current % only.
- Evening report: non-completed tasks are also shown under 次の日の作業 with Target % only.
- Tasks with Progress = Complete / 完了 are automatically omitted from 次の日の作業.
- The same task list is used for both morning and evening; no Today/Next day controls were added.
- Progress options remain English in the UI while Japanese values are used in generated reports.
- The compact Note field remains private to the extension and is not included in reports.
- Slack task-name hyperlinks remain supported.

Install / update
1. Extract this folder somewhere permanent.
2. Open chrome://extensions/.
3. Enable Developer mode.
4. If already installed, replace the old extension files with these files and click Reload.
   If installing fresh, click Load unpacked and select this folder.
