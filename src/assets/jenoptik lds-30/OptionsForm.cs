using System;
using System.ComponentModel;
using System.Drawing;
using System.Media;
using System.Windows.Forms;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000005 RID: 5
	public partial class OptionsForm : Form
	{
		// Token: 0x06000010 RID: 16 RVA: 0x00003FA2 File Offset: 0x000021A2
		public OptionsForm()
		{
			this.InitializeComponent();
		}

		// Token: 0x06000011 RID: 17 RVA: 0x00003FE0 File Offset: 0x000021E0
		private void Options_Load(object sender, EventArgs e)
		{
			this.cmbobxDefaultLoggingMode.Items.Clear();
			this.cmbobxNotificationSound.Items.Clear();
			this.cmbobxDefaultLoggingMode.Items.Add(enLoggingMode.Manual_Logging.ToString());
			this.cmbobxDefaultLoggingMode.Items.Add(enLoggingMode.Auto_Obj_Detection.ToString());
			this.cmbobxDefaultLoggingMode.Items.Add(enLoggingMode.Log_All_Data.ToString());
			this.cmbobxNotificationSound.Items.Add(enNotificationSound.None.ToString());
			this.cmbobxNotificationSound.Items.Add(enNotificationSound.Beep.ToString());
			this.cmbobxNotificationSound.Items.Add(enNotificationSound.Ding.ToString());
			this.cmbobxNotificationSound.Items.Add(enNotificationSound.Horn.ToString());
			this.cmbobxDefaultLoggingMode.Text = Program.AppPropertiesObject.AppConfig.enumDefaultLoggingMode.ToString();
			this.cmbobxNotificationSound.Text = Program.AppPropertiesObject.AppConfig.enumNotificationSound.ToString();
			this.chkbxRequireGps.Checked = Program.AppPropertiesObject.AppConfig.bRequireGps;
			this.chkbxUseTemperatureField.Checked = Program.AppPropertiesObject.AppConfig.bUseTemperature;
			this.chkbxUseRouteSegmentField.Checked = Program.AppPropertiesObject.AppConfig.bUseRouteSegment;
		}

		// Token: 0x06000012 RID: 18 RVA: 0x0000418C File Offset: 0x0000238C
		private void btnSetOptions_Click(object sender, EventArgs e)
		{
			enLoggingMode enumDefaultLoggingMode;
			Enum.TryParse<enLoggingMode>(this.cmbobxDefaultLoggingMode.Text, out enumDefaultLoggingMode);
			enNotificationSound enumNotificationSound;
			Enum.TryParse<enNotificationSound>(this.cmbobxNotificationSound.Text, out enumNotificationSound);
			bool @checked = this.chkbxUseTemperatureField.Checked;
			bool checked2 = this.chkbxUseRouteSegmentField.Checked;
			bool checked3 = this.chkbxRequireGps.Checked;
			Program.AppPropertiesObject.AppConfig.enumDefaultLoggingMode = enumDefaultLoggingMode;
			Program.AppPropertiesObject.AppConfig.enumNotificationSound = enumNotificationSound;
			Program.AppPropertiesObject.AppConfig.bUseTemperature = @checked;
			Program.AppPropertiesObject.AppConfig.bUseRouteSegment = checked2;
			Program.AppPropertiesObject.AppConfig.bRequireGps = checked3;
			Program.AppPropertiesSave();
			base.Close();
		}

		// Token: 0x06000013 RID: 19 RVA: 0x00004240 File Offset: 0x00002440
		private void btnPlaySound_Click(object sender, EventArgs e)
		{
			if (this.cmbobxNotificationSound.Text == enNotificationSound.Beep.ToString())
			{
				this.OptionsStopAllSounds();
				this.objNotificationBeep.Play();
				return;
			}
			if (this.cmbobxNotificationSound.Text == enNotificationSound.Ding.ToString())
			{
				this.OptionsStopAllSounds();
				this.objNotificationDing.Play();
				return;
			}
			if (this.cmbobxNotificationSound.Text == enNotificationSound.Horn.ToString())
			{
				this.OptionsStopAllSounds();
				this.objNotificationHorn.Play();
				return;
			}
			this.OptionsStopAllSounds();
		}

		// Token: 0x06000014 RID: 20 RVA: 0x000042EC File Offset: 0x000024EC
		private void OptionsStopAllSounds()
		{
			this.objNotificationBeep.Stop();
			this.objNotificationDing.Stop();
			this.objNotificationHorn.Stop();
		}

		// Token: 0x06000015 RID: 21 RVA: 0x0000430F File Offset: 0x0000250F
		private void Options_FormClosing(object sender, FormClosingEventArgs e)
		{
			this.OptionsStopAllSounds();
		}

		// Token: 0x04000028 RID: 40
		private SoundPlayer objNotificationBeep = new SoundPlayer(Resource1.BEEPDOUB);

		// Token: 0x04000029 RID: 41
		private SoundPlayer objNotificationDing = new SoundPlayer(Resource1.Windows7GardenDing);

		// Token: 0x0400002A RID: 42
		private SoundPlayer objNotificationHorn = new SoundPlayer(Resource1.bizniss_horn);
	}
}
