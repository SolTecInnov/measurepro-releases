using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000002 RID: 2
	public partial class GpsConfigForm : Form
	{
		// Token: 0x06000001 RID: 1 RVA: 0x00002050 File Offset: 0x00000250
		public GpsConfigForm()
		{
			this.InitializeComponent();
		}

		// Token: 0x06000002 RID: 2 RVA: 0x00002060 File Offset: 0x00000260
		private void GpsConfig_Load(object sender, EventArgs e)
		{
			this.chkbxGpsPingEnabled.Checked = Program.AppPropertiesObject.GpsConfig.bPingEnabled;
			this.txtbxGpsPingDistance.Text = Program.AppPropertiesObject.GpsConfig.iPingDistance_ft.ToString("D");
			this.cmbobxGpsFormat.SelectedIndex = (int)Program.AppPropertiesObject.GpsConfig.enumGpsDataFormat;
		}

		// Token: 0x06000003 RID: 3 RVA: 0x000020C8 File Offset: 0x000002C8
		private void btnSetGpsConfig_Click(object sender, EventArgs e)
		{
			int num = Convert.ToInt32(this.txtbxGpsPingDistance.Text);
			if (num < 0)
			{
				num = 0;
			}
			enGpsDataFormat selectedIndex = (enGpsDataFormat)this.cmbobxGpsFormat.SelectedIndex;
			Program.AppPropertiesObject.GpsConfig.bPingEnabled = this.chkbxGpsPingEnabled.Checked;
			Program.AppPropertiesObject.GpsConfig.iPingDistance_ft = num;
			Program.AppPropertiesObject.GpsConfig.enumGpsDataFormat = selectedIndex;
			Program.AppPropertiesSave();
			base.Close();
		}
	}
}
