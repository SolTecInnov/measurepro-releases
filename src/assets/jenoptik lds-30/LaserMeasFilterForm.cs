using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000003 RID: 3
	public partial class LaserMeasFilterForm : Form
	{
		// Token: 0x06000006 RID: 6 RVA: 0x000025D2 File Offset: 0x000007D2
		public LaserMeasFilterForm()
		{
			this.InitializeComponent();
		}

		// Token: 0x06000007 RID: 7 RVA: 0x000025E0 File Offset: 0x000007E0
		private void frmLaserMeasFilter_Load(object sender, EventArgs e)
		{
			this.txtbxIntensityThresh.Text = Program.AppPropertiesObject.LaserDataConfig.iIntensityThreshold.ToString("D");
			this.txtbxDistThresh.Text = Program.AppPropertiesObject.LaserDataConfig.fDistanceThreshold_m.ToString("F1");
		}

		// Token: 0x06000008 RID: 8 RVA: 0x0000263C File Offset: 0x0000083C
		private void btnSetFilterParam_Click(object sender, EventArgs e)
		{
			int num;
			try
			{
				num = Convert.ToInt32(this.txtbxIntensityThresh.Text);
			}
			catch (FormatException)
			{
				num = 0;
			}
			if (num <= 0)
			{
				num = 1;
			}
			this.txtbxIntensityThresh.Text = num.ToString("D");
			double num2;
			try
			{
				num2 = Convert.ToDouble(this.txtbxDistThresh.Text);
			}
			catch (FormatException)
			{
				num2 = 0.0;
			}
			if (num2 < 0.0)
			{
				num2 = 0.0;
			}
			this.txtbxDistThresh.Text = num2.ToString("F1");
			Program.SetLaserMeasFilterParam(num, num2);
			base.Close();
		}
	}
}
