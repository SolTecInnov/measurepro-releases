using System;
using System.ComponentModel;
using System.Drawing;
using System.IO.Ports;
using System.Linq;
using System.Windows.Forms;

namespace RSA_Laser_Test_App
{
	// Token: 0x0200000C RID: 12
	public partial class SerialPortConfigForm : Form
	{
		// Token: 0x0600004A RID: 74 RVA: 0x00004C58 File Offset: 0x00002E58
		public SerialPortConfigForm()
		{
			this.InitializeComponent();
		}

		// Token: 0x0600004B RID: 75 RVA: 0x00004C68 File Offset: 0x00002E68
		private void SerialPortConfig_Load(object sender, EventArgs e)
		{
			this.cmbobxLaserComPort.Items.Clear();
			this.cmbobxLaserBaudRate.Items.Clear();
			this.cmbobxGpsComPort.Items.Clear();
			this.cmbobxGpsBaudRate.Items.Clear();
			string[] portNames = SerialPort.GetPortNames();
			foreach (string item in portNames)
			{
				this.cmbobxLaserComPort.Items.Add(item);
				this.cmbobxGpsComPort.Items.Add(item);
			}
			string laserComPortName = Program.GetLaserComPortName();
			string gpsComPortName = Program.GetGpsComPortName();
			enLaserBaudRate enumLaserBaudRate = Program.AppPropertiesObject.ComConfig.enumLaserBaudRate;
			enGpsBaudRate enumGpsBaudRate = Program.AppPropertiesObject.ComConfig.enumGpsBaudRate;
			if (portNames.Contains(laserComPortName))
			{
				this.cmbobxLaserComPort.Text = laserComPortName;
			}
			if (portNames.Contains(gpsComPortName))
			{
				this.cmbobxGpsComPort.Text = gpsComPortName;
			}
			this.cmbobxLaserBaudRate.Items.Add(enLaserBaudRate.b460800.ToString());
			this.cmbobxLaserBaudRate.Items.Add(enLaserBaudRate.b921600.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b4800.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b9600.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b19200.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b38400.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b57600.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b115200.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b230400.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b460800.ToString());
			this.cmbobxGpsBaudRate.Items.Add(enGpsBaudRate.b921600.ToString());
			this.cmbobxLaserBaudRate.Text = enumLaserBaudRate.ToString();
			this.cmbobxGpsBaudRate.Text = enumGpsBaudRate.ToString();
			Program.ComSettingsAbort = true;
		}

		// Token: 0x0600004C RID: 76 RVA: 0x00004F24 File Offset: 0x00003124
		private void btnSetInputComPorts_Click(object sender, EventArgs e)
		{
			Program.AppPropertiesObject.ComConfig.sLaserPortName = this.cmbobxLaserComPort.Text;
			Program.AppPropertiesObject.ComConfig.sGpsPortName = this.cmbobxGpsComPort.Text;
			enLaserBaudRate enumLaserBaudRate;
			if (Enum.TryParse<enLaserBaudRate>(this.cmbobxLaserBaudRate.Text, out enumLaserBaudRate))
			{
				Program.AppPropertiesObject.ComConfig.enumLaserBaudRate = enumLaserBaudRate;
			}
			enGpsBaudRate enumGpsBaudRate;
			if (Enum.TryParse<enGpsBaudRate>(this.cmbobxGpsBaudRate.Text, out enumGpsBaudRate))
			{
				Program.AppPropertiesObject.ComConfig.enumGpsBaudRate = enumGpsBaudRate;
			}
			if (Program.AppPropertiesObject.ComConfig.sLaserPortName != Program.AppPropertiesObject.ComConfig.sGpsPortName)
			{
				Program.ComSettingsAbort = false;
				Program.AppPropertiesSave();
				Program.SetComPorts();
				base.Close();
				return;
			}
			MessageBox.Show("Cannot set the same COM port for more than one device.", "ERROR", MessageBoxButtons.OK);
		}
	}
}
