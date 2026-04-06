namespace RSA_Laser_Test_App
{
	// Token: 0x02000002 RID: 2
	public partial class GpsConfigForm : global::System.Windows.Forms.Form
	{
		// Token: 0x06000004 RID: 4 RVA: 0x0000213D File Offset: 0x0000033D
		protected override void Dispose(bool disposing)
		{
			if (disposing && this.components != null)
			{
				this.components.Dispose();
			}
			base.Dispose(disposing);
		}

		// Token: 0x06000005 RID: 5 RVA: 0x0000215C File Offset: 0x0000035C
		private void InitializeComponent()
		{
			this.chkbxGpsPingEnabled = new global::System.Windows.Forms.CheckBox();
			this.txtbxGpsPingDistance = new global::System.Windows.Forms.TextBox();
			this.lblGpsPingDistance = new global::System.Windows.Forms.Label();
			this.btnSetGpsConfig = new global::System.Windows.Forms.Button();
			this.lblGpsFormat = new global::System.Windows.Forms.Label();
			this.cmbobxGpsFormat = new global::System.Windows.Forms.ComboBox();
			base.SuspendLayout();
			this.chkbxGpsPingEnabled.AutoSize = true;
			this.chkbxGpsPingEnabled.Location = new global::System.Drawing.Point(17, 16);
			this.chkbxGpsPingEnabled.Margin = new global::System.Windows.Forms.Padding(4);
			this.chkbxGpsPingEnabled.Name = "chkbxGpsPingEnabled";
			this.chkbxGpsPingEnabled.Size = new global::System.Drawing.Size(212, 21);
			this.chkbxGpsPingEnabled.TabIndex = 0;
			this.chkbxGpsPingEnabled.Text = "GPS Logging \"Ping\" Enabled";
			this.chkbxGpsPingEnabled.UseVisualStyleBackColor = true;
			this.txtbxGpsPingDistance.Location = new global::System.Drawing.Point(17, 96);
			this.txtbxGpsPingDistance.Margin = new global::System.Windows.Forms.Padding(4);
			this.txtbxGpsPingDistance.Name = "txtbxGpsPingDistance";
			this.txtbxGpsPingDistance.Size = new global::System.Drawing.Size(179, 22);
			this.txtbxGpsPingDistance.TabIndex = 1;
			this.lblGpsPingDistance.AutoSize = true;
			this.lblGpsPingDistance.Location = new global::System.Drawing.Point(16, 60);
			this.lblGpsPingDistance.Margin = new global::System.Windows.Forms.Padding(4, 0, 4, 0);
			this.lblGpsPingDistance.MaximumSize = new global::System.Drawing.Size(180, 32);
			this.lblGpsPingDistance.MinimumSize = new global::System.Drawing.Size(180, 32);
			this.lblGpsPingDistance.Name = "lblGpsPingDistance";
			this.lblGpsPingDistance.Size = new global::System.Drawing.Size(180, 32);
			this.lblGpsPingDistance.TabIndex = 2;
			this.lblGpsPingDistance.Text = "GPS \"Ping\" Distance (feet)\r\n[Default = 528 ft = 0.1 mi]";
			this.btnSetGpsConfig.Location = new global::System.Drawing.Point(17, 232);
			this.btnSetGpsConfig.Margin = new global::System.Windows.Forms.Padding(4);
			this.btnSetGpsConfig.Name = "btnSetGpsConfig";
			this.btnSetGpsConfig.Size = new global::System.Drawing.Size(124, 68);
			this.btnSetGpsConfig.TabIndex = 3;
			this.btnSetGpsConfig.Text = "Set Parameters";
			this.btnSetGpsConfig.UseVisualStyleBackColor = true;
			this.btnSetGpsConfig.Click += new global::System.EventHandler(this.btnSetGpsConfig_Click);
			this.lblGpsFormat.AutoSize = true;
			this.lblGpsFormat.Location = new global::System.Drawing.Point(16, 146);
			this.lblGpsFormat.Name = "lblGpsFormat";
			this.lblGpsFormat.Size = new global::System.Drawing.Size(119, 17);
			this.lblGpsFormat.TabIndex = 4;
			this.lblGpsFormat.Text = "GPS Data Format";
			this.cmbobxGpsFormat.DropDownStyle = global::System.Windows.Forms.ComboBoxStyle.DropDownList;
			this.cmbobxGpsFormat.FormattingEnabled = true;
			this.cmbobxGpsFormat.Items.AddRange(new object[]
			{
				"Default (Legacy Format)",
				"Decimal Degrees",
				"Degrees Minutes Seconds",
				"Degrees & Decimal Minutes"
			});
			this.cmbobxGpsFormat.Location = new global::System.Drawing.Point(17, 166);
			this.cmbobxGpsFormat.Name = "cmbobxGpsFormat";
			this.cmbobxGpsFormat.Size = new global::System.Drawing.Size(276, 24);
			this.cmbobxGpsFormat.TabIndex = 5;
			base.AutoScaleDimensions = new global::System.Drawing.SizeF(8f, 16f);
			base.AutoScaleMode = global::System.Windows.Forms.AutoScaleMode.Font;
			base.ClientSize = new global::System.Drawing.Size(322, 313);
			base.Controls.Add(this.cmbobxGpsFormat);
			base.Controls.Add(this.lblGpsFormat);
			base.Controls.Add(this.btnSetGpsConfig);
			base.Controls.Add(this.lblGpsPingDistance);
			base.Controls.Add(this.txtbxGpsPingDistance);
			base.Controls.Add(this.chkbxGpsPingEnabled);
			base.Margin = new global::System.Windows.Forms.Padding(4);
			base.MaximizeBox = false;
			this.MaximumSize = new global::System.Drawing.Size(340, 360);
			base.MinimizeBox = false;
			this.MinimumSize = new global::System.Drawing.Size(340, 360);
			base.Name = "GpsConfigForm";
			base.SizeGripStyle = global::System.Windows.Forms.SizeGripStyle.Hide;
			base.StartPosition = global::System.Windows.Forms.FormStartPosition.CenterParent;
			this.Text = "GPS Parameters";
			base.Load += new global::System.EventHandler(this.GpsConfig_Load);
			base.ResumeLayout(false);
			base.PerformLayout();
		}

		// Token: 0x04000001 RID: 1
		private global::System.ComponentModel.IContainer components;

		// Token: 0x04000002 RID: 2
		private global::System.Windows.Forms.CheckBox chkbxGpsPingEnabled;

		// Token: 0x04000003 RID: 3
		private global::System.Windows.Forms.TextBox txtbxGpsPingDistance;

		// Token: 0x04000004 RID: 4
		private global::System.Windows.Forms.Label lblGpsPingDistance;

		// Token: 0x04000005 RID: 5
		private global::System.Windows.Forms.Button btnSetGpsConfig;

		// Token: 0x04000006 RID: 6
		private global::System.Windows.Forms.Label lblGpsFormat;

		// Token: 0x04000007 RID: 7
		private global::System.Windows.Forms.ComboBox cmbobxGpsFormat;
	}
}
