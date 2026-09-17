Daily Work Report Generator v1.5.3

Private Chrome extension for creating daily Japanese morning/evening Slack reports.

Changes in 1.5.3
- Added a "Request for more task" checkbox in the Tasks view.
- When checked, the morning report adds this before the closing greeting:
  もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。
- When checked, the evening report adds these before the closing greeting:
  本日に現在のタスクがすべて完了する予定です。
  もし追加でご依頼いただけるタスクがございましたら、ご登録いただけますでしょうか。
- The checkbox state is saved automatically.

Previous behavior retained
- Morning report date is the next Japan calendar day (+1 day).
- Evening report date uses the current Japan date.
- Morning report: completed tasks are automatically omitted.
- Morning report: all non-completed tasks are shown once with Current % and Target %.
- Evening report: every task is shown under 今日の作業 with Current % only.
- Evening report: non-completed tasks are also shown under 次の日の作業 with Target % only.
- Tasks with Progress = Complete / 完了 are automatically omitted from 次の日の作業.
- The same task list is used for both morning and evening; no Today/Next day controls are used.
- Progress options remain English in the UI while Japanese values are used in generated reports.
- The compact Note field remains private to the extension and is not included in reports.
- Slack task-name hyperlinks remain supported.

Install / update
1. Extract this folder somewhere permanent.
2. Open chrome://extensions/.
3. Enable Developer mode.
4. If already installed, replace the old extension files with these files and click Reload.
   If installing fresh, click Load unpacked and select this folder.
