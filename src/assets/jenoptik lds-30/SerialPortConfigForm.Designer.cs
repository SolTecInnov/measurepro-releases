namespace RSA_Laser_Test_App
{
	// Token: 0x0200000C RID: 12
	public partial class SerialPortConfigForm : global::System.Windows.Forms.Form
	{
		// Token: 0x0600004D RID: 77 RVA: 0x00004FFA File Offset: 0x000031FA
		protected override void Dispose(bool disposing)
		{
			if (disposing && this.components != null)
			{
				this.components.Dispose();
			}
			base.Dispose(disposing);
		}

		// Token: 0x0600004E RID: 78 RVA: 0x0000501C File Offset: 0x0000321C
		private void InitializeComponent()
		{
			global::System.ComponentModel.ComponentResourceManager componentResourceManager = new global::System.ComponentModel.ComponentResourceManager(typeof(global::RSA_Laser_Test_App.SerialPortConfigForm));
			this.lblLaserComPortInput = new global::System.Windows.Forms.Label();
			this.lblGpsComPortInput = new global::System.Windows.Forms.Label();
			this.btnSetInputComPorts = new global::System.Windows.Forms.Button();
			this.lblLaserBaudRate = new global::System.Windows.Forms.Label();
			this.lblGpsBaudRate = new global::System.Windows.Forms.Label();
			this.cmbobxLaserComPort = new global::System.Windows.Forms.ComboBox();
			this.cmbobxGpsComPort = new global::System.Windows.Forms.ComboBox();
			this.cmbobxGpsBaudRate = new global::System.Windows.Forms.ComboBox();
			this.cmbobxLaserBaudRate = new global::System.Windows.Forms.ComboBox();
			base.SuspendLayout();
			this.lblLaserComPortInput.AutoSize = true;
			this.lblLaserComPortInput.Location = new global::System.Drawing.Point(12, 9);
			this.lblLaserComPortInput.Name = "lblLaserComPortInput";
			this.lblLaserComPortInput.Size = new global::System.Drawing.Size(84, 13);
			this.lblLaserComPortInput.TabIndex = 1;
			this.lblLaserComPortInput.Text = "Laser Serial Port";
			this.lblGpsComPortInput.AutoSize = true;
			this.lblGpsComPortInput.Location = new global::System.Drawing.Point(164, 9);
			this.lblGpsComPortInput.Name = "lblGpsComPortInput";
			this.lblGpsComPortInput.Size = new global::System.Drawing.Size(80, 13);
			this.lblGpsComPortInput.TabIndex = 2;
			this.lblGpsComPortInput.Text = "GPS Serial Port";
			this.btnSetInputComPorts.Location = new global::System.Drawing.Point(12, 115);
			this.btnSetInputComPorts.Name = "btnSetInputComPorts";
			this.btnSetInputComPorts.Size = new global::System.Drawing.Size(96, 55);
			this.btnSetInputComPorts.TabIndex = 4;
			this.btnSetInputComPorts.Text = "Set COM Ports";
			this.btnSetInputComPorts.UseVisualStyleBackColor = true;
			this.btnSetInputComPorts.Click += new global::System.EventHandler(this.btnSetInputComPorts_Click);
			this.lblLaserBaudRate.AutoSize = true;
			this.lblLaserBaudRate.Location = new global::System.Drawing.Point(12, 53);
			this.lblLaserBaudRate.Name = "lblLaserBaudRate";
			this.lblLaserBaudRate.Size = new global::System.Drawing.Size(87, 13);
			this.lblLaserBaudRate.TabIndex = 5;
			this.lblLaserBaudRate.Text = "Laser Baud Rate";
			this.lblGpsBaudRate.AutoSize = true;
			this.lblGpsBaudRate.Location = new global::System.Drawing.Point(164, 53);
			this.lblGpsBaudRate.Name = "lblGpsBaudRate";
			this.lblGpsBaudRate.Size = new global::System.Drawing.Size(83, 13);
			this.lblGpsBaudRate.TabIndex = 6;
			this.lblGpsBaudRate.Text = "GPS Baud Rate";
			this.cmbobxLaserComPort.FormattingEnabled = true;
			this.cmbobxLaserComPort.Location = new global::System.Drawing.Point(15, 24);
			this.cmbobxLaserComPort.Name = "cmbobxLaserComPort";
			this.cmbobxLaserComPort.Size = new global::System.Drawing.Size(133, 21);
			this.cmbobxLaserComPort.TabIndex = 7;
			this.cmbobxGpsComPort.FormattingEnabled = true;
			this.cmbobxGpsComPort.Location = new global::System.Drawing.Point(167, 24);
			this.cmbobxGpsComPort.Name = "cmbobxGpsComPort";
			this.cmbobxGpsComPort.Size = new global::System.Drawing.Size(133, 21);
			this.cmbobxGpsComPort.TabIndex = 8;
			this.cmbobxGpsBaudRate.FormattingEnabled = true;
			this.cmbobxGpsBaudRate.Location = new global::System.Drawing.Point(167, 69);
			this.cmbobxGpsBaudRate.Name = "cmbobxGpsBaudRate";
			this.cmbobxGpsBaudRate.Size = new global::System.Drawing.Size(133, 21);
			this.cmbobxGpsBaudRate.TabIndex = 10;
			this.cmbobxLaserBaudRate.FormattingEnabled = true;
			this.cmbobxLaserBaudRate.Location = new global::System.Drawing.Point(15, 69);
			this.cmbobxLaserBaudRate.Name = "cmbobxLaserBaudRate";
			this.cmbobxLaserBaudRate.Size = new global::System.Drawing.Size(133, 21);
			this.cmbobxLaserBaudRate.TabIndex = 9;
			base.AutoScaleDimensions = new global::System.Drawing.SizeF(6f, 13f);
			base.AutoScaleMode = global::System.Windows.Forms.AutoScaleMode.Font;
			base.ClientSize = new global::System.Drawing.Size(312, 182);
			base.Controls.Add(this.cmbobxGpsBaudRate);
			base.Controls.Add(this.cmbobxLaserBaudRate);
			base.Controls.Add(this.cmbobxGpsComPort);
			base.Controls.Add(this.cmbobxLaserComPort);
			base.Controls.Add(this.lblGpsBaudRate);
			base.Controls.Add(this.lblLaserBaudRate);
			base.Controls.Add(this.btnSetInputComPorts);
			base.Controls.Add(this.lblGpsComPortInput);
			base.Controls.Add(this.lblLaserComPortInput);
			base.Icon = (global::System.Drawing.Icon)componentResourceManager.GetObject("$this.Icon");
			base.MaximizeBox = false;
			this.MaximumSize = new global::System.Drawing.Size(328, 220);
			base.MinimizeBox = false;
			this.MinimumSize = new global::System.Drawing.Size(328, 220);
			base.Name = "SerialPortConfigForm";
			base.SizeGripStyle = global::System.Windows.Forms.SizeGripStyle.Hide;
			base.StartPosition = global::System.Windows.Forms.FormStartPosition.CenterParent;
			this.Text = "Serial Port Configuration";
			base.Load += new global::System.EventHandler(this.SerialPortConfig_Load);
			base.ResumeLayout(false);
			base.PerformLayout();
		}

		// Token: 0x0400004C RID: 76
		private global::System.ComponentModel.IContainer components;

		// Token: 0x0400004D RID: 77
		private global::System.Windows.Forms.Label lblLaserComPortInput;

		// Token: 0x0400004E RID: 78
		private global::System.Windows.Forms.Label lblGpsComPortInput;

		// Token: 0x0400004F RID: 79
		private global::System.Windows.Forms.Button btnSetInputComPorts;

		// Token: 0x04000050 RID: 80
		private global::System.Windows.Forms.Label lblLaserBaudRate;

		// Token: 0x04000051 RID: 81
		private global::System.Windows.Forms.Label lblGpsBaudRate;

		// Token: 0x04000052 RID: 82
		private global::System.Windows.Forms.ComboBox cmbobxLaserComPort;

		// Token: 0x04000053 RID: 83
		private global::System.Windows.Forms.ComboBox cmbobxGpsComPort;

		// Token: 0x04000054 RID: 84
		private global::System.Windows.Forms.ComboBox cmbobxGpsBaudRate;

		// Token: 0x04000055 RID: 85
		private global::System.Windows.Forms.ComboBox cmbobxLaserBaudRate;
	}
}
