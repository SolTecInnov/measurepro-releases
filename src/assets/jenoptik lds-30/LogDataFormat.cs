using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000004 RID: 4
	public partial class LogDataFormat : Form
	{
		// Token: 0x0600000B RID: 11 RVA: 0x00002B51 File Offset: 0x00000D51
		public LogDataFormat()
		{
			this.InitializeComponent();
		}

		// Token: 0x0600000C RID: 12 RVA: 0x00002B60 File Offset: 0x00000D60
		private void LogDataFormat_Load(object sender, EventArgs e)
		{
			this.cmbobxColumn1.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[0];
			this.cmbobxColumn2.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[1];
			this.cmbobxColumn3.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[2];
			this.cmbobxColumn4.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[3];
			this.cmbobxColumn5.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[4];
			this.cmbobxColumn6.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[5];
			this.cmbobxColumn7.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[6];
			this.cmbobxColumn8.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[7];
			this.cmbobxColumn9.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[8];
			this.cmbobxColumn10.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[9];
			this.cmbobxColumn11.SelectedIndex = (int)Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[10];
		}

		// Token: 0x0600000D RID: 13 RVA: 0x00002C6C File Offset: 0x00000E6C
		private void btnSetLogFileFormat_Click(object sender, EventArgs e)
		{
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[0] = (enDataColumn)this.cmbobxColumn1.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[1] = (enDataColumn)this.cmbobxColumn2.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[2] = (enDataColumn)this.cmbobxColumn3.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[3] = (enDataColumn)this.cmbobxColumn4.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[4] = (enDataColumn)this.cmbobxColumn5.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[5] = (enDataColumn)this.cmbobxColumn6.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[6] = (enDataColumn)this.cmbobxColumn7.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[7] = (enDataColumn)this.cmbobxColumn8.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[8] = (enDataColumn)this.cmbobxColumn9.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[9] = (enDataColumn)this.cmbobxColumn10.SelectedIndex;
			Program.AppPropertiesObject.a1enumLoggingDataColumnConfig[10] = (enDataColumn)this.cmbobxColumn11.SelectedIndex;
			Program.AppPropertiesSave();
			base.Close();
		}
	}
}
