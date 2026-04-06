namespace RSA_Laser_Test_App
{
	// Token: 0x02000003 RID: 3
	public partial class LaserMeasFilterForm : global::System.Windows.Forms.Form
	{
		// Token: 0x06000009 RID: 9 RVA: 0x000026F4 File Offset: 0x000008F4
		protected override void Dispose(bool disposing)
		{
			if (disposing && this.components != null)
			{
				this.components.Dispose();
			}
			base.Dispose(disposing);
		}

		// Token: 0x0600000A RID: 10 RVA: 0x00002714 File Offset: 0x00000914
		private void InitializeComponent()
		{
			global::System.ComponentModel.ComponentResourceManager componentResourceManager = new global::System.ComponentModel.ComponentResourceManager(typeof(global::RSA_Laser_Test_App.LaserMeasFilterForm));
			this.lblIntensityThresh = new global::System.Windows.Forms.Label();
			this.txtbxIntensityThresh = new global::System.Windows.Forms.TextBox();
			this.lblDistThresh = new global::System.Windows.Forms.Label();
			this.txtbxDistThresh = new global::System.Windows.Forms.TextBox();
			this.btnSetFilterParam = new global::System.Windows.Forms.Button();
			this.lblIntensityThreshNote = new global::System.Windows.Forms.Label();
			this.lblDistThreshNote = new global::System.Windows.Forms.Label();
			base.SuspendLayout();
			this.lblIntensityThresh.AutoSize = true;
			this.lblIntensityThresh.Location = new global::System.Drawing.Point(25, 18);
			this.lblIntensityThresh.Name = "lblIntensityThresh";
			this.lblIntensityThresh.Size = new global::System.Drawing.Size(157, 13);
			this.lblIntensityThresh.TabIndex = 0;
			this.lblIntensityThresh.Text = "Intensity Threshold [Default = 6]";
			this.txtbxIntensityThresh.Location = new global::System.Drawing.Point(28, 50);
			this.txtbxIntensityThresh.Name = "txtbxIntensityThresh";
			this.txtbxIntensityThresh.Size = new global::System.Drawing.Size(140, 20);
			this.txtbxIntensityThresh.TabIndex = 1;
			this.lblDistThresh.AutoSize = true;
			this.lblDistThresh.Location = new global::System.Drawing.Point(25, 85);
			this.lblDistThresh.Name = "lblDistThresh";
			this.lblDistThresh.Size = new global::System.Drawing.Size(203, 13);
			this.lblDistThresh.TabIndex = 2;
			this.lblDistThresh.Text = "Distance Threshold [Default = 0.0 meters]";
			this.txtbxDistThresh.Location = new global::System.Drawing.Point(28, 117);
			this.txtbxDistThresh.Name = "txtbxDistThresh";
			this.txtbxDistThresh.Size = new global::System.Drawing.Size(140, 20);
			this.txtbxDistThresh.TabIndex = 3;
			this.btnSetFilterParam.Location = new global::System.Drawing.Point(28, 161);
			this.btnSetFilterParam.Name = "btnSetFilterParam";
			this.btnSetFilterParam.Size = new global::System.Drawing.Size(118, 59);
			this.btnSetFilterParam.TabIndex = 4;
			this.btnSetFilterParam.Text = "Set Filter Parameters";
			this.btnSetFilterParam.UseVisualStyleBackColor = true;
			this.btnSetFilterParam.Click += new global::System.EventHandler(this.btnSetFilterParam_Click);
			this.lblIntensityThreshNote.AutoSize = true;
			this.lblIntensityThreshNote.Location = new global::System.Drawing.Point(25, 34);
			this.lblIntensityThreshNote.Name = "lblIntensityThreshNote";
			this.lblIntensityThreshNote.Size = new global::System.Drawing.Size(308, 13);
			this.lblIntensityThreshNote.TabIndex = 5;
			this.lblIntensityThreshNote.Text = "(Measurements with less than this intensity value will be ignored)";
			this.lblDistThreshNote.AutoSize = true;
			this.lblDistThreshNote.Location = new global::System.Drawing.Point(25, 101);
			this.lblDistThreshNote.Name = "lblDistThreshNote";
			this.lblDistThreshNote.Size = new global::System.Drawing.Size(312, 13);
			this.lblDistThreshNote.TabIndex = 6;
			this.lblDistThreshNote.Text = "(Raw distance measurements less than this value will be ignored)";
			base.AutoScaleDimensions = new global::System.Drawing.SizeF(6f, 13f);
			base.AutoScaleMode = global::System.Windows.Forms.AutoScaleMode.Font;
			base.ClientSize = new global::System.Drawing.Size(373, 243);
			base.Controls.Add(this.lblDistThreshNote);
			base.Controls.Add(this.lblIntensityThreshNote);
			base.Controls.Add(this.btnSetFilterParam);
			base.Controls.Add(this.txtbxDistThresh);
			base.Controls.Add(this.lblDistThresh);
			base.Controls.Add(this.txtbxIntensityThresh);
			base.Controls.Add(this.lblIntensityThresh);
			base.Icon = (global::System.Drawing.Icon)componentResourceManager.GetObject("$this.Icon");
			base.MaximizeBox = false;
			this.MaximumSize = new global::System.Drawing.Size(389, 281);
			base.MinimizeBox = false;
			this.MinimumSize = new global::System.Drawing.Size(389, 281);
			base.Name = "LaserMeasFilterForm";
			base.SizeGripStyle = global::System.Windows.Forms.SizeGripStyle.Hide;
			base.StartPosition = global::System.Windows.Forms.FormStartPosition.CenterParent;
			this.Text = "Laser Measurement Filter Parameters";
			base.Load += new global::System.EventHandler(this.frmLaserMeasFilter_Load);
			base.ResumeLayout(false);
			base.PerformLayout();
		}

		// Token: 0x04000008 RID: 8
		private global::System.ComponentModel.IContainer components;

		// Token: 0x04000009 RID: 9
		private global::System.Windows.Forms.Label lblIntensityThresh;

		// Token: 0x0400000A RID: 10
		private global::System.Windows.Forms.TextBox txtbxIntensityThresh;

		// Token: 0x0400000B RID: 11
		private global::System.Windows.Forms.Label lblDistThresh;

		// Token: 0x0400000C RID: 12
		private global::System.Windows.Forms.TextBox txtbxDistThresh;

		// Token: 0x0400000D RID: 13
		private global::System.Windows.Forms.Button btnSetFilterParam;

		// Token: 0x0400000E RID: 14
		private global::System.Windows.Forms.Label lblIntensityThreshNote;

		// Token: 0x0400000F RID: 15
		private global::System.Windows.Forms.Label lblDistThreshNote;
	}
}
