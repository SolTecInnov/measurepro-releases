namespace RSA_Laser_Test_App
{
	// Token: 0x02000005 RID: 5
	public partial class OptionsForm : global::System.Windows.Forms.Form
	{
		// Token: 0x06000016 RID: 22 RVA: 0x00004317 File Offset: 0x00002517
		protected override void Dispose(bool disposing)
		{
			if (disposing && this.components != null)
			{
				this.components.Dispose();
			}
			base.Dispose(disposing);
		}

		// Token: 0x06000017 RID: 23 RVA: 0x00004338 File Offset: 0x00002538
		private void InitializeComponent()
		{
			this.chkbxUseRouteSegmentField = new global::System.Windows.Forms.CheckBox();
			this.chkbxUseTemperatureField = new global::System.Windows.Forms.CheckBox();
			this.btnSetOptions = new global::System.Windows.Forms.Button();
			this.cmbobxDefaultLoggingMode = new global::System.Windows.Forms.ComboBox();
			this.lblDefaultLoggingMode = new global::System.Windows.Forms.Label();
			this.lblNotificationSound = new global::System.Windows.Forms.Label();
			this.cmbobxNotificationSound = new global::System.Windows.Forms.ComboBox();
			this.btnPlaySound = new global::System.Windows.Forms.Button();
			this.chkbxRequireGps = new global::System.Windows.Forms.CheckBox();
			base.SuspendLayout();
			this.chkbxUseRouteSegmentField.AutoSize = true;
			this.chkbxUseRouteSegmentField.Location = new global::System.Drawing.Point(16, 198);
			this.chkbxUseRouteSegmentField.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.chkbxUseRouteSegmentField.Name = "chkbxUseRouteSegmentField";
			this.chkbxUseRouteSegmentField.Size = new global::System.Drawing.Size(269, 21);
			this.chkbxUseRouteSegmentField.TabIndex = 1;
			this.chkbxUseRouteSegmentField.Text = "Use Route Segment Field (show in UI)";
			this.chkbxUseRouteSegmentField.UseVisualStyleBackColor = true;
			this.chkbxUseTemperatureField.AutoSize = true;
			this.chkbxUseTemperatureField.Location = new global::System.Drawing.Point(16, 226);
			this.chkbxUseTemperatureField.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.chkbxUseTemperatureField.Name = "chkbxUseTemperatureField";
			this.chkbxUseTemperatureField.Size = new global::System.Drawing.Size(253, 21);
			this.chkbxUseTemperatureField.TabIndex = 2;
			this.chkbxUseTemperatureField.Text = "Use Temperature Field (show in UI)";
			this.chkbxUseTemperatureField.UseVisualStyleBackColor = true;
			this.btnSetOptions.Location = new global::System.Drawing.Point(16, 284);
			this.btnSetOptions.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.btnSetOptions.Name = "btnSetOptions";
			this.btnSetOptions.Size = new global::System.Drawing.Size(124, 68);
			this.btnSetOptions.TabIndex = 4;
			this.btnSetOptions.Text = "Set Options";
			this.btnSetOptions.UseVisualStyleBackColor = true;
			this.btnSetOptions.Click += new global::System.EventHandler(this.btnSetOptions_Click);
			this.cmbobxDefaultLoggingMode.DropDownStyle = global::System.Windows.Forms.ComboBoxStyle.DropDownList;
			this.cmbobxDefaultLoggingMode.FormattingEnabled = true;
			this.cmbobxDefaultLoggingMode.Location = new global::System.Drawing.Point(16, 41);
			this.cmbobxDefaultLoggingMode.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.cmbobxDefaultLoggingMode.Name = "cmbobxDefaultLoggingMode";
			this.cmbobxDefaultLoggingMode.Size = new global::System.Drawing.Size(363, 24);
			this.cmbobxDefaultLoggingMode.TabIndex = 5;
			this.lblDefaultLoggingMode.AutoSize = true;
			this.lblDefaultLoggingMode.Location = new global::System.Drawing.Point(16, 17);
			this.lblDefaultLoggingMode.Margin = new global::System.Windows.Forms.Padding(4, 0, 4, 0);
			this.lblDefaultLoggingMode.Name = "lblDefaultLoggingMode";
			this.lblDefaultLoggingMode.Size = new global::System.Drawing.Size(147, 17);
			this.lblDefaultLoggingMode.TabIndex = 6;
			this.lblDefaultLoggingMode.Text = "Default Logging Mode";
			this.lblNotificationSound.AutoSize = true;
			this.lblNotificationSound.Location = new global::System.Drawing.Point(16, 91);
			this.lblNotificationSound.Margin = new global::System.Windows.Forms.Padding(4, 0, 4, 0);
			this.lblNotificationSound.Name = "lblNotificationSound";
			this.lblNotificationSound.Size = new global::System.Drawing.Size(223, 17);
			this.lblNotificationSound.TabIndex = 8;
			this.lblNotificationSound.Text = "Object Logging Notification Sound";
			this.cmbobxNotificationSound.DropDownStyle = global::System.Windows.Forms.ComboBoxStyle.DropDownList;
			this.cmbobxNotificationSound.FormattingEnabled = true;
			this.cmbobxNotificationSound.Location = new global::System.Drawing.Point(16, 114);
			this.cmbobxNotificationSound.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.cmbobxNotificationSound.Name = "cmbobxNotificationSound";
			this.cmbobxNotificationSound.Size = new global::System.Drawing.Size(160, 24);
			this.cmbobxNotificationSound.TabIndex = 7;
			this.btnPlaySound.Location = new global::System.Drawing.Point(256, 114);
			this.btnPlaySound.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.btnPlaySound.Name = "btnPlaySound";
			this.btnPlaySound.Size = new global::System.Drawing.Size(124, 26);
			this.btnPlaySound.TabIndex = 9;
			this.btnPlaySound.Text = "Play Sound";
			this.btnPlaySound.UseVisualStyleBackColor = true;
			this.btnPlaySound.Click += new global::System.EventHandler(this.btnPlaySound_Click);
			this.chkbxRequireGps.AutoSize = true;
			this.chkbxRequireGps.Location = new global::System.Drawing.Point(16, 170);
			this.chkbxRequireGps.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			this.chkbxRequireGps.Name = "chkbxRequireGps";
			this.chkbxRequireGps.Size = new global::System.Drawing.Size(241, 21);
			this.chkbxRequireGps.TabIndex = 10;
			this.chkbxRequireGps.Text = "Disable Logging If No GPS Signal";
			this.chkbxRequireGps.UseVisualStyleBackColor = true;
			base.AutoScaleDimensions = new global::System.Drawing.SizeF(8f, 16f);
			base.AutoScaleMode = global::System.Windows.Forms.AutoScaleMode.Font;
			base.ClientSize = new global::System.Drawing.Size(389, 354);
			base.Controls.Add(this.chkbxRequireGps);
			base.Controls.Add(this.btnPlaySound);
			base.Controls.Add(this.lblNotificationSound);
			base.Controls.Add(this.cmbobxNotificationSound);
			base.Controls.Add(this.lblDefaultLoggingMode);
			base.Controls.Add(this.cmbobxDefaultLoggingMode);
			base.Controls.Add(this.btnSetOptions);
			base.Controls.Add(this.chkbxUseTemperatureField);
			base.Controls.Add(this.chkbxUseRouteSegmentField);
			base.Margin = new global::System.Windows.Forms.Padding(4, 4, 4, 4);
			base.MaximizeBox = false;
			this.MaximumSize = new global::System.Drawing.Size(407, 401);
			base.MinimizeBox = false;
			this.MinimumSize = new global::System.Drawing.Size(407, 401);
			base.Name = "OptionsForm";
			base.StartPosition = global::System.Windows.Forms.FormStartPosition.CenterParent;
			this.Text = "Options";
			base.FormClosing += new global::System.Windows.Forms.FormClosingEventHandler(this.Options_FormClosing);
			base.Load += new global::System.EventHandler(this.Options_Load);
			base.ResumeLayout(false);
			base.PerformLayout();
		}

		// Token: 0x0400002B RID: 43
		private global::System.ComponentModel.IContainer components;

		// Token: 0x0400002C RID: 44
		private global::System.Windows.Forms.CheckBox chkbxUseRouteSegmentField;

		// Token: 0x0400002D RID: 45
		private global::System.Windows.Forms.CheckBox chkbxUseTemperatureField;

		// Token: 0x0400002E RID: 46
		private global::System.Windows.Forms.Button btnSetOptions;

		// Token: 0x0400002F RID: 47
		private global::System.Windows.Forms.ComboBox cmbobxDefaultLoggingMode;

		// Token: 0x04000030 RID: 48
		private global::System.Windows.Forms.Label lblDefaultLoggingMode;

		// Token: 0x04000031 RID: 49
		private global::System.Windows.Forms.Label lblNotificationSound;

		// Token: 0x04000032 RID: 50
		private global::System.Windows.Forms.ComboBox cmbobxNotificationSound;

		// Token: 0x04000033 RID: 51
		private global::System.Windows.Forms.Button btnPlaySound;

		// Token: 0x04000034 RID: 52
		private global::System.Windows.Forms.CheckBox chkbxRequireGps;
	}
}
