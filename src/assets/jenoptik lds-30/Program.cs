using System;
using System.Collections.Concurrent;
using System.Globalization;
using System.IO;
using System.IO.Ports;
using System.Linq;
using System.Threading;
using System.Windows.Forms;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000016 RID: 22
	internal static class Program
	{
		// Token: 0x17000017 RID: 23
		// (get) Token: 0x0600007A RID: 122 RVA: 0x0000A420 File Offset: 0x00008620
		public static string Version
		{
			get
			{
				return "1.0.11";
			}
		}

		// Token: 0x17000018 RID: 24
		// (get) Token: 0x0600007B RID: 123 RVA: 0x0000A427 File Offset: 0x00008627
		public static int LaserQueueDepth
		{
			get
			{
				return Program.iLaserQueueDepth;
			}
		}

		// Token: 0x17000019 RID: 25
		// (get) Token: 0x0600007C RID: 124 RVA: 0x0000A42E File Offset: 0x0000862E
		public static int GpsQueueDepth
		{
			get
			{
				return Program.iGpsQueueDepth;
			}
		}

		// Token: 0x1700001A RID: 26
		// (get) Token: 0x0600007D RID: 125 RVA: 0x0000A435 File Offset: 0x00008635
		// (set) Token: 0x0600007E RID: 126 RVA: 0x0000A43C File Offset: 0x0000863C
		public static bool DataEventHandlersGo
		{
			get
			{
				return Program.bDataEventHandlersGo;
			}
			set
			{
				Program.bDataEventHandlersGo = value;
			}
		}

		// Token: 0x1700001B RID: 27
		// (get) Token: 0x0600007F RID: 127 RVA: 0x0000A444 File Offset: 0x00008644
		// (set) Token: 0x06000080 RID: 128 RVA: 0x0000A44B File Offset: 0x0000864B
		public static bool ComPortsValid
		{
			get
			{
				return Program.bComPortsValidFlag;
			}
			set
			{
				Program.bComPortsValidFlag = value;
			}
		}

		// Token: 0x1700001C RID: 28
		// (get) Token: 0x06000081 RID: 129 RVA: 0x0000A453 File Offset: 0x00008653
		// (set) Token: 0x06000082 RID: 130 RVA: 0x0000A45A File Offset: 0x0000865A
		public static bool ComSettingsAbort
		{
			get
			{
				return Program.bComSettingsAbort;
			}
			set
			{
				Program.bComSettingsAbort = value;
			}
		}

		// Token: 0x1700001D RID: 29
		// (get) Token: 0x06000083 RID: 131 RVA: 0x0000A462 File Offset: 0x00008662
		// (set) Token: 0x06000084 RID: 132 RVA: 0x0000A469 File Offset: 0x00008669
		public static string TimeStampDisplay
		{
			get
			{
				return Program.sTimeStampDisplay;
			}
			set
			{
				Program.sTimeStampDisplay = value;
			}
		}

		// Token: 0x1700001E RID: 30
		// (get) Token: 0x06000085 RID: 133 RVA: 0x0000A471 File Offset: 0x00008671
		// (set) Token: 0x06000086 RID: 134 RVA: 0x0000A478 File Offset: 0x00008678
		public static string LaserDataDisplay
		{
			get
			{
				return Program.sLaserDataDisplayString;
			}
			set
			{
				Program.sLaserDataDisplayString = value;
			}
		}

		// Token: 0x1700001F RID: 31
		// (get) Token: 0x06000087 RID: 135 RVA: 0x0000A480 File Offset: 0x00008680
		public static string MinimumHeightDisplay
		{
			get
			{
				return Program.sMinimumHeightDisplayString;
			}
		}

		// Token: 0x17000020 RID: 32
		// (get) Token: 0x06000088 RID: 136 RVA: 0x0000A487 File Offset: 0x00008687
		public static string GpsDataDisplay
		{
			get
			{
				return Program.sGpsDataDisplayString;
			}
		}

		// Token: 0x17000021 RID: 33
		// (get) Token: 0x06000089 RID: 137 RVA: 0x0000A48E File Offset: 0x0000868E
		public static int GpsNumberOfSatellites
		{
			get
			{
				return Program.iGpsNumSats;
			}
		}

		// Token: 0x17000022 RID: 34
		// (get) Token: 0x0600008A RID: 138 RVA: 0x0000A495 File Offset: 0x00008695
		// (set) Token: 0x0600008B RID: 139 RVA: 0x0000A49C File Offset: 0x0000869C
		public static bool HeightAlarm
		{
			get
			{
				return Program.bAlarmFlag;
			}
			set
			{
				Program.bAlarmFlag = value;
			}
		}

		// Token: 0x17000023 RID: 35
		// (get) Token: 0x0600008C RID: 140 RVA: 0x0000A4A4 File Offset: 0x000086A4
		// (set) Token: 0x0600008D RID: 141 RVA: 0x0000A4AB File Offset: 0x000086AB
		public static bool HeightNotification
		{
			get
			{
				return Program.bNotificationFlag;
			}
			set
			{
				Program.bNotificationFlag = value;
			}
		}

		// Token: 0x17000024 RID: 36
		// (get) Token: 0x0600008E RID: 142 RVA: 0x0000A4B3 File Offset: 0x000086B3
		// (set) Token: 0x0600008F RID: 143 RVA: 0x0000A4BA File Offset: 0x000086BA
		public static enLoggingMode CurrentLoggingModeSetting
		{
			get
			{
				return Program.enumCurrentLoggingMode;
			}
			set
			{
				Program.enumCurrentLoggingMode = value;
			}
		}

		// Token: 0x17000025 RID: 37
		// (get) Token: 0x06000090 RID: 144 RVA: 0x0000A4C2 File Offset: 0x000086C2
		// (set) Token: 0x06000091 RID: 145 RVA: 0x0000A4C9 File Offset: 0x000086C9
		public static AppProperties AppPropertiesObject
		{
			get
			{
				return Program.objAppProperties;
			}
			set
			{
				Program.objAppProperties = value;
			}
		}

		// Token: 0x06000092 RID: 146 RVA: 0x0000A4D4 File Offset: 0x000086D4
		[STAThread]
		private static void Main()
		{
			Program.objLaserPort = new SerialPort();
			Program.objGpsPort = new SerialPort();
			Application.SetCompatibleTextRenderingDefault(false);
			SerialPortConfigForm serialPortConfigForm = new SerialPortConfigForm();
			Program.objLaserPort.DataBits = 8;
			Program.objLaserPort.StopBits = StopBits.One;
			Program.objLaserPort.Parity = Parity.None;
			Program.objLaserPort.Handshake = Handshake.None;
			Program.objLaserPort.NewLine = Convert.ToString('\r');
			Program.objGpsPort.DataBits = 8;
			Program.objGpsPort.StopBits = StopBits.One;
			Program.objGpsPort.Parity = Parity.None;
			Program.objGpsPort.Handshake = Handshake.None;
			string[] portNames = SerialPort.GetPortNames();
			if (File.Exists(Application.StartupPath + "\\" + Program.sAppSettingsFile))
			{
				Program.AppPropertiesLoad();
				if (portNames.Contains(Program.objAppProperties.ComConfig.sLaserPortName))
				{
					Program.objLaserPort.PortName = Program.objAppProperties.ComConfig.sLaserPortName;
				}
				else if (portNames.Length >= 1)
				{
					Program.objLaserPort.PortName = portNames[0];
					MessageBox.Show("Invalid laser port name in JSON file, port set to " + Program.objLaserPort.PortName + ".", "Configuration Error", MessageBoxButtons.OK);
				}
				else
				{
					Program.objLaserPort.PortName = "COM1";
					MessageBox.Show("Invalid laser port name in JSON file, port set to " + Program.objLaserPort.PortName + ".", "Configuration Error", MessageBoxButtons.OK);
				}
				Program.objLaserPort.BaudRate = (int)Program.objAppProperties.ComConfig.enumLaserBaudRate;
				if (portNames.Contains(Program.objAppProperties.ComConfig.sGpsPortName) && Program.objAppProperties.ComConfig.sGpsPortName != Program.objAppProperties.ComConfig.sLaserPortName)
				{
					Program.objGpsPort.PortName = Program.objAppProperties.ComConfig.sGpsPortName;
				}
				else if (portNames.Length >= 2)
				{
					Program.objGpsPort.PortName = portNames[1];
					MessageBox.Show("Invalid GPS port name in JSON file, port set to " + Program.objGpsPort.PortName + ".", "Configuration Error", MessageBoxButtons.OK);
				}
				else
				{
					Program.objGpsPort.PortName = "COM2";
					MessageBox.Show("Invalid GPS port name in JSON file, port set to " + Program.objGpsPort.PortName + ".", "Configuration Error", MessageBoxButtons.OK);
				}
				Program.objGpsPort.BaudRate = (int)Program.objAppProperties.ComConfig.enumGpsBaudRate;
				if (!Program.ValidateMaxHeight())
				{
					Program.AppPropertiesSave();
				}
			}
			else
			{
				serialPortConfigForm.ShowDialog();
				Program.AppPropertiesSave();
			}
			Program.enumCurrentLoggingMode = Program.objAppProperties.AppConfig.enumDefaultLoggingMode;
			Program.objLaserDataLock.AcquireWriterLock(5);
			try
			{
				Program.bLoggingFlag = false;
			}
			finally
			{
				Program.objLaserDataLock.ReleaseWriterLock();
			}
			Program.objLaserPort.ReceivedBytesThreshold = 3;
			Program.objLaserPort.DataReceived += Program.LaserDataReceivedHandler;
			Program.objLaserPort.DtrEnable = true;
			Program.objGpsPort.ReceivedBytesThreshold = 1;
			Program.objGpsPort.DataReceived += Program.GpsDataReceivedHandler;
			Program.objGpsPort.DtrEnable = true;
			do
			{
				Program.bComPortsValidFlag = true;
				try
				{
					Program.objLaserPort.Open();
				}
				catch (UnauthorizedAccessException)
				{
					Program.bComPortsValidFlag = false;
					MessageBox.Show("Unable to access laser serial port.", "Exception", MessageBoxButtons.OK);
				}
				catch (IOException)
				{
					Program.bComPortsValidFlag = false;
					MessageBox.Show("Laser serial port does not exist.", "Exception", MessageBoxButtons.OK);
				}
				catch (InvalidOperationException)
				{
				}
				try
				{
					Program.objGpsPort.Open();
				}
				catch (UnauthorizedAccessException)
				{
					Program.bComPortsValidFlag = false;
					MessageBox.Show("Unable to access GPS serial port.", "Exception", MessageBoxButtons.OK);
				}
				catch (IOException)
				{
					Program.bComPortsValidFlag = false;
					MessageBox.Show("GPS serial port does not exist.", "Exception", MessageBoxButtons.OK);
				}
				catch (InvalidOperationException)
				{
				}
				if (!Program.bComPortsValidFlag)
				{
					try
					{
						Program.objLaserPort.Close();
					}
					catch (IOException)
					{
					}
					try
					{
						Program.objGpsPort.Close();
					}
					catch (IOException)
					{
					}
					serialPortConfigForm.ShowDialog();
				}
			}
			while (!Program.bComPortsValidFlag && !Program.bComSettingsAbort);
			if (!Program.bComSettingsAbort)
			{
				Program.bDataEventHandlersGo = true;
				new Thread(new ThreadStart(Program.LoggingTask))
				{
					IsBackground = true
				}.Start();
				new Thread(new ThreadStart(Program.ProcessGpsTask))
				{
					IsBackground = true
				}.Start();
				new Thread(new ThreadStart(Program.ProcessLaserDataTask))
				{
					IsBackground = true
				}.Start();
				Application.EnableVisualStyles();
				Application.Run(new MainForm());
				return;
			}
			MessageBox.Show("Could not configure serial ports.", "Terminating Application", MessageBoxButtons.OK);
		}

		// Token: 0x06000093 RID: 147 RVA: 0x0000A990 File Offset: 0x00008B90
		public static bool ComPortValid(string sPortName)
		{
			return SerialPort.GetPortNames().Contains(sPortName);
		}

		// Token: 0x06000094 RID: 148 RVA: 0x0000A9A0 File Offset: 0x00008BA0
		public static string CreateLogFileName()
		{
			return "Log-" + DateTime.Now.ToString("yyyy-MM-dd(HH-mm-ss-ffff)") + ".csv";
		}

		// Token: 0x06000095 RID: 149 RVA: 0x0000A9D0 File Offset: 0x00008BD0
		public static void SendToLaser(string sAsciiText)
		{
			try
			{
				Program.objLaserPort.WriteLine(sAsciiText);
			}
			catch (ArgumentNullException)
			{
			}
			catch (InvalidOperationException)
			{
				MessageBox.Show("Laser serial port is not open.", "Exception", MessageBoxButtons.OK);
			}
			catch (TimeoutException)
			{
				MessageBox.Show("Could not write to laser serial port.", "Exception", MessageBoxButtons.OK);
			}
		}

		// Token: 0x06000096 RID: 150 RVA: 0x0000AA40 File Offset: 0x00008C40
		public static void AppPropertiesLoad()
		{
			string value = File.ReadAllText(Application.StartupPath + "\\" + Program.sAppSettingsFile);
			try
			{
				Program.objAppProperties = JsonConvert.DeserializeObject<AppProperties>(value);
			}
			catch
			{
				MessageBox.Show("Error in AppPropertiesLoad: Could not de-serialize the application properties file.", "ERROR", MessageBoxButtons.OK);
			}
		}

		// Token: 0x06000097 RID: 151 RVA: 0x0000AA98 File Offset: 0x00008C98
		public static void AppPropertiesSave()
		{
			string path = Application.StartupPath + "\\" + Program.sAppSettingsFile;
			string value = JsonConvert.SerializeObject(Program.objAppProperties, Formatting.Indented);
			using (StreamWriter streamWriter = new StreamWriter(path, false))
			{
				streamWriter.WriteLine(value);
			}
		}

		// Token: 0x06000098 RID: 152 RVA: 0x0000AAF0 File Offset: 0x00008CF0
		public static void DetectObjectCounterIncrement()
		{
			if (Program.iObjectDetectionCounter < 10)
			{
				Program.iObjectDetectionCounter++;
			}
		}

		// Token: 0x06000099 RID: 153 RVA: 0x0000AB07 File Offset: 0x00008D07
		public static void DetectObjectCounterReset()
		{
			Program.iObjectDetectionCounter = 0;
		}

		// Token: 0x0600009A RID: 154 RVA: 0x0000AB10 File Offset: 0x00008D10
		public static void ClearReceiveBuffer()
		{
			try
			{
				Program.objLaserPort.ReadExisting();
			}
			catch (InvalidOperationException)
			{
				MessageBox.Show("Laser serial port is not open.", "Exception", MessageBoxButtons.OK);
			}
		}

		// Token: 0x0600009B RID: 155 RVA: 0x0000AB50 File Offset: 0x00008D50
		public static void CloseComPorts()
		{
			Program.bDataEventHandlersGo = false;
			Program.LoggingStop();
			if (Program.objLaserPort.IsOpen)
			{
				Program.SendToLaser(Convert.ToString('\u001b'));
			}
			Program.objGpsPort.Close();
			Program.objLaserPort.Close();
		}

		// Token: 0x0600009C RID: 156 RVA: 0x0000AB89 File Offset: 0x00008D89
		public static void OpenLaserComPort()
		{
			Program.objLaserPort.Open();
		}

		// Token: 0x0600009D RID: 157 RVA: 0x0000AB95 File Offset: 0x00008D95
		public static void OpenGpsComPort()
		{
			Program.objGpsPort.Open();
		}

		// Token: 0x0600009E RID: 158 RVA: 0x0000ABA4 File Offset: 0x00008DA4
		public static void QueueLogEntry(string sLongitude, string sLatitude, string sHeight, string sItem, string sDescription, string sDateTime, string sGpsSats, string sLaserIntensity, string sTemperature, string sRoute)
		{
			string[] array = new string[11];
			string[] array2 = sDateTime.Split(new char[]
			{
				','
			});
			array[0] = sLongitude;
			array[1] = sLatitude;
			array[2] = sHeight;
			array[3] = sItem;
			array[4] = sDescription;
			array[5] = array2[0];
			array[6] = array2[1];
			array[7] = sGpsSats;
			array[8] = sLaserIntensity;
			array[9] = sTemperature;
			array[10] = sRoute;
			string text = Program.DataColumnString(array, Program.objAppProperties.a1enumLoggingDataColumnConfig[0]);
			for (int i = 1; i < 11; i++)
			{
				text = text + "," + Program.DataColumnString(array, Program.objAppProperties.a1enumLoggingDataColumnConfig[i]);
			}
			try
			{
				Program.objLoggingQueue.Add(text);
			}
			catch (ObjectDisposedException)
			{
				MessageBox.Show("LoggingQueue object has been disposed.", "Exception", MessageBoxButtons.OK);
			}
			catch (InvalidOperationException)
			{
				MessageBox.Show("LoggingQueue invalid operation.", "Exception", MessageBoxButtons.OK);
			}
		}

		// Token: 0x0600009F RID: 159 RVA: 0x0000AC9C File Offset: 0x00008E9C
		private static string DataColumnString(string[] a1sDataRow, enDataColumn enumColumnType)
		{
			string result = "";
			if (enumColumnType == enDataColumn.Blank)
			{
				result = "";
			}
			else if (enumColumnType == enDataColumn.Longitude)
			{
				result = a1sDataRow[0];
			}
			else if (enumColumnType == enDataColumn.Latitude)
			{
				result = a1sDataRow[1];
			}
			else if (enumColumnType == enDataColumn.Height)
			{
				result = a1sDataRow[2];
			}
			else if (enumColumnType == enDataColumn.Item)
			{
				result = a1sDataRow[3];
			}
			else if (enumColumnType == enDataColumn.Description)
			{
				result = a1sDataRow[4];
			}
			else if (enumColumnType == enDataColumn.Date)
			{
				result = a1sDataRow[5];
			}
			else if (enumColumnType == enDataColumn.Time)
			{
				result = a1sDataRow[6];
			}
			else if (enumColumnType == enDataColumn.Num_Gps_Sats)
			{
				result = a1sDataRow[7];
			}
			else if (enumColumnType == enDataColumn.Laser_Intensity)
			{
				result = a1sDataRow[8];
			}
			else if (enumColumnType == enDataColumn.Temperature)
			{
				result = a1sDataRow[9];
			}
			else if (enumColumnType == enDataColumn.Route_Segment)
			{
				result = a1sDataRow[10];
			}
			return result;
		}

		// Token: 0x060000A0 RID: 160 RVA: 0x0000AD2C File Offset: 0x00008F2C
		public static void ResetMinDistance()
		{
			Program.ResetMinDistanceNoLog();
			if (Program.bLoggingFlag)
			{
				string sLongitude = "";
				string sLatitude = "";
				string sGpsSats = "";
				Program.objGpsDataLock.AcquireReaderLock(5);
				try
				{
					sLongitude = Program.FormatGpsLongitude();
					sLatitude = Program.FormatGpsLatitude();
					sGpsSats = Program.FormatGpsSats();
				}
				finally
				{
					Program.objGpsDataLock.ReleaseReaderLock();
				}
				Program.QueueLogEntry(sLongitude, sLatitude, "", "", "Reset Minimum", Program.GetTimeStampString(), sGpsSats, "", "", "");
			}
		}

		// Token: 0x060000A1 RID: 161 RVA: 0x0000ADC0 File Offset: 0x00008FC0
		public static void ResetMinDistanceNoLog()
		{
			Program.fMinDistance = 30.0;
			Program.DetectObjectCounterReset();
			Program.sLsrThreadMinString = "";
			Program.a1sLogStrings[0] = "";
			Program.a1sLogStrings[1] = "";
			Program.a1sLogStrings[2] = "";
			Program.a1sLogStrings[3] = "";
			Program.a1sLogStrings[4] = "";
			Program.a1sLogStrings[5] = "";
			Program.a1sLogStrings[6] = "";
			Program.a1sLogStrings[7] = "";
		}

		// Token: 0x060000A2 RID: 162 RVA: 0x0000AE4A File Offset: 0x0000904A
		public static string GetLaserComPortName()
		{
			return Program.objLaserPort.PortName;
		}

		// Token: 0x060000A3 RID: 163 RVA: 0x0000AE56 File Offset: 0x00009056
		public static string GetGpsComPortName()
		{
			return Program.objGpsPort.PortName;
		}

		// Token: 0x060000A4 RID: 164 RVA: 0x0000AE64 File Offset: 0x00009064
		public static void SetComPorts()
		{
			Program.objLaserPort.PortName = Program.objAppProperties.ComConfig.sLaserPortName;
			Program.objLaserPort.BaudRate = (int)Program.objAppProperties.ComConfig.enumLaserBaudRate;
			Program.objGpsPort.PortName = Program.objAppProperties.ComConfig.sGpsPortName;
			Program.objGpsPort.BaudRate = (int)Program.objAppProperties.ComConfig.enumGpsBaudRate;
		}

		// Token: 0x060000A5 RID: 165 RVA: 0x0000AED5 File Offset: 0x000090D5
		public static void SetLaserMeasFilterParam(int iIntensity, double fDistance)
		{
			Program.objAppProperties.LaserDataConfig.iIntensityThreshold = iIntensity;
			Program.objAppProperties.LaserDataConfig.fDistanceThreshold_m = fDistance;
			Program.ValidateMaxHeight();
			Program.AppPropertiesSave();
		}

		// Token: 0x060000A6 RID: 166 RVA: 0x0000AF04 File Offset: 0x00009104
		public static bool ValidateMaxHeight()
		{
			if (Program.objAppProperties.HeightConfig.fMaxHeight_m > Program.objAppProperties.HeightConfig.fBaseHeight_m + 30.0)
			{
				Program.objAppProperties.HeightConfig.fMaxHeight_m = Program.objAppProperties.HeightConfig.fBaseHeight_m + 30.0;
				return false;
			}
			if (Program.objAppProperties.HeightConfig.fMaxHeight_m < Program.objAppProperties.HeightConfig.fBaseHeight_m + Program.objAppProperties.LaserDataConfig.fDistanceThreshold_m + 0.1)
			{
				Program.objAppProperties.HeightConfig.fMaxHeight_m = Program.objAppProperties.HeightConfig.fBaseHeight_m + Program.objAppProperties.LaserDataConfig.fDistanceThreshold_m + 0.1;
				return false;
			}
			return true;
		}

		// Token: 0x060000A7 RID: 167 RVA: 0x0000AFDC File Offset: 0x000091DC
		public static void SetBaseHeight(double Height)
		{
			try
			{
				Program.objLaserDataLock.AcquireWriterLock(5);
				try
				{
					Program.objAppProperties.HeightConfig.fBaseHeight_m = Height;
					Program.ValidateMaxHeight();
					Program.AppPropertiesSave();
				}
				finally
				{
					Program.objLaserDataLock.ReleaseWriterLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("SetBaseHeight writerlock timeout.");
			}
		}

		// Token: 0x060000A8 RID: 168 RVA: 0x0000B048 File Offset: 0x00009248
		public static double GetBaseHeight()
		{
			double result = 0.0;
			try
			{
				Program.objLaserDataLock.AcquireReaderLock(5);
				try
				{
					result = Program.objAppProperties.HeightConfig.fBaseHeight_m;
				}
				finally
				{
					Program.objLaserDataLock.ReleaseReaderLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("GetBaseHeight readerlock timeout.");
			}
			return result;
		}

		// Token: 0x060000A9 RID: 169 RVA: 0x0000B0B4 File Offset: 0x000092B4
		public static void SetAlarmHeight(double Height)
		{
			try
			{
				Program.objLaserDataLock.AcquireWriterLock(5);
				try
				{
					Program.objAppProperties.HeightConfig.fAlarmHeight_m = Height;
					Program.AppPropertiesSave();
				}
				finally
				{
					Program.objLaserDataLock.ReleaseWriterLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("SetAlarmHeight writerlock timeout.");
			}
		}

		// Token: 0x060000AA RID: 170 RVA: 0x0000B11C File Offset: 0x0000931C
		public static double GetAlarmHeight()
		{
			double result = 0.0;
			try
			{
				Program.objLaserDataLock.AcquireReaderLock(5);
				try
				{
					result = Program.objAppProperties.HeightConfig.fAlarmHeight_m;
				}
				finally
				{
					Program.objLaserDataLock.ReleaseReaderLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("GetAlarmHeight readerlock timeout.");
			}
			return result;
		}

		// Token: 0x060000AB RID: 171 RVA: 0x0000B188 File Offset: 0x00009388
		public static void SetMaxHeight(double Height)
		{
			try
			{
				Program.objLaserDataLock.AcquireWriterLock(5);
				try
				{
					Program.objAppProperties.HeightConfig.fMaxHeight_m = Height;
					Program.ValidateMaxHeight();
					Program.AppPropertiesSave();
				}
				finally
				{
					Program.objLaserDataLock.ReleaseWriterLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("SetMaxHeight writerlock timeout.");
			}
		}

		// Token: 0x060000AC RID: 172 RVA: 0x0000B1F4 File Offset: 0x000093F4
		public static double GetMaxHeight()
		{
			double result = 0.0;
			try
			{
				Program.objLaserDataLock.AcquireReaderLock(5);
				try
				{
					result = Program.objAppProperties.HeightConfig.fMaxHeight_m;
				}
				finally
				{
					Program.objLaserDataLock.ReleaseReaderLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("GetMaxHeight readerlock timeout.");
			}
			return result;
		}

		// Token: 0x060000AD RID: 173 RVA: 0x0000B260 File Offset: 0x00009460
		public static void LoggingStart(string FileName)
		{
			try
			{
				Program.objLaserDataLock.AcquireWriterLock(5);
				try
				{
					Program.sLogFileName = FileName;
					Program.bLoggingFlag = true;
					Program.QueueLogEntry("Longitude", "Latitude", "Height", "Item", "Description", "Date,Time", "# of GPS Sats", "Laser Intensity", "Temperature", "Route Segment");
				}
				finally
				{
					Program.objLaserDataLock.ReleaseWriterLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("LoggingStart writerlock timeout.");
			}
		}

		// Token: 0x060000AE RID: 174 RVA: 0x0000B2F8 File Offset: 0x000094F8
		public static void LoggingStop()
		{
			try
			{
				Program.objLaserDataLock.AcquireWriterLock(5);
				try
				{
					Program.bLoggingFlag = false;
				}
				finally
				{
					Program.objLaserDataLock.ReleaseWriterLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("LoggingStop writerlock timeout.");
			}
		}

		// Token: 0x060000AF RID: 175 RVA: 0x0000B350 File Offset: 0x00009550
		public static bool LoggingStatus()
		{
			return Program.bLoggingFlag;
		}

		// Token: 0x060000B0 RID: 176 RVA: 0x0000B35C File Offset: 0x0000955C
		public static void LoggingTask()
		{
			foreach (string text in Program.objLoggingQueue.GetConsumingEnumerable())
			{
				if (Program.bLoggingFlag)
				{
					using (StreamWriter streamWriter = new StreamWriter(Program.sLogFileName, true))
					{
						streamWriter.WriteLine(text.ToString());
					}
					Program.frmMainForm.BeginInvoke(Program.frmMainForm.AddLogEntryList, new object[]
					{
						text.ToString()
					});
				}
			}
		}

		// Token: 0x060000B1 RID: 177 RVA: 0x0000B404 File Offset: 0x00009604
		public static void SetMetricFlag(bool bValue)
		{
			try
			{
				Program.objLaserDataLock.AcquireWriterLock(5);
				try
				{
					Program.bMetricUnits = bValue;
				}
				finally
				{
					Program.objLaserDataLock.ReleaseWriterLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("SetMetricFlag writerlock timeout.");
			}
		}

		// Token: 0x060000B2 RID: 178 RVA: 0x0000B45C File Offset: 0x0000965C
		public static bool GetMetricFlag()
		{
			bool result = true;
			try
			{
				Program.objLaserDataLock.AcquireReaderLock(5);
				try
				{
					result = Program.bMetricUnits;
				}
				finally
				{
					Program.objLaserDataLock.ReleaseReaderLock();
				}
			}
			catch (ApplicationException)
			{
				Console.WriteLine("GetMetricFlag readerlock timeout.");
			}
			return result;
		}

		// Token: 0x060000B3 RID: 179 RVA: 0x0000B4B8 File Offset: 0x000096B8
		public static void SetMainFormControl(MainForm frmMain)
		{
			Program.frmMainForm = frmMain;
		}

		// Token: 0x060000B4 RID: 180 RVA: 0x0000B4C0 File Offset: 0x000096C0
		public static void ConvertMetersToFeetInch(double fValMeter, out int iValFeet, out double fValInch)
		{
			double num = Math.Round(fValMeter / 0.0254, 2, MidpointRounding.AwayFromZero);
			if (num >= 12.0)
			{
				iValFeet = (int)(num / 12.0);
				fValInch = num - (double)(12 * iValFeet);
				return;
			}
			iValFeet = 0;
			fValInch = num;
		}

		// Token: 0x060000B5 RID: 181 RVA: 0x0000B50C File Offset: 0x0000970C
		public static string GetTimeStampString()
		{
			return DateTime.Now.ToString("dd/MM/yyyy,HH:mm:ss:ffff");
		}

		// Token: 0x060000B6 RID: 182 RVA: 0x0000B52C File Offset: 0x0000972C
		private static void LaserDataReceivedHandler(object Sender, SerialDataReceivedEventArgs e)
		{
			byte[] array = new byte[3];
			LaserDataItem item = default(LaserDataItem);
			if (!Program.bDataEventHandlersGo)
			{
				return;
			}
			int bytesToRead = Program.objLaserPort.BytesToRead;
			if (bytesToRead < 3)
			{
				return;
			}
			string timeStampString = Program.GetTimeStampString();
			for (int i = bytesToRead; i >= 3; i -= 3)
			{
				if (!Program.bDataEventHandlersGo)
				{
					return;
				}
				Program.objLaserPort.Read(array, 0, 3);
				if ((128 & array[0]) != 0 && (128 & array[1]) == 0 && (128 & array[2]) == 0)
				{
					item.sTimeStamp = timeStampString;
					item.a1byteDataBuffer = array;
					item.enumErrorCode = enLaserDataError.None;
				}
				else
				{
					item.sTimeStamp = timeStampString;
					item.a1byteDataBuffer = array;
					if ((128 & array[1]) != 0 && Program.objLaserPort.BytesToRead >= 1)
					{
						Program.objLaserPort.Read(array, 0, 1);
						item.enumErrorCode = enLaserDataError.Shift_1;
					}
					else if ((128 & array[2]) != 0 && Program.objLaserPort.BytesToRead >= 2)
					{
						Program.objLaserPort.Read(array, 0, 2);
						item.enumErrorCode = enLaserDataError.Shift_2;
					}
				}
				Program.objLaserQueue.Add(item);
			}
		}

		// Token: 0x060000B7 RID: 183 RVA: 0x0000B648 File Offset: 0x00009848
		public static void ProcessLaserDataTask()
		{
			foreach (LaserDataItem laserDataItem in Program.objLaserQueue.GetConsumingEnumerable())
			{
				Program.iLaserQueueDepth = Program.objLaserQueue.Count;
				if (!Program.bDataEventHandlersGo)
				{
					break;
				}
				if (laserDataItem.a1byteDataBuffer.Length != 3)
				{
					Console.WriteLine("ProcessLaserDataTask:  DataBuffer.Length != 3");
					break;
				}
				double num;
				if (laserDataItem.enumErrorCode == enLaserDataError.None)
				{
					num = (double)(((int)(laserDataItem.a1byteDataBuffer[0] & 127) << 7) + (int)laserDataItem.a1byteDataBuffer[1]) / 100.0;
					int num2 = (int)(laserDataItem.a1byteDataBuffer[2] * 2);
					try
					{
						Program.objLaserDataLock.AcquireWriterLock(5);
						try
						{
							double num3 = Program.fMinDistance + Program.objAppProperties.HeightConfig.fBaseHeight_m;
							int num4;
							double num5;
							Program.ConvertMetersToFeetInch(num3, out num4, out num5);
							if (num < Program.fMinDistance && num > Program.objAppProperties.LaserDataConfig.fDistanceThreshold_m && num2 > Program.objAppProperties.LaserDataConfig.iIntensityThreshold && num + Program.objAppProperties.HeightConfig.fBaseHeight_m <= Program.objAppProperties.HeightConfig.fMaxHeight_m)
							{
								Program.fMinDistance = num;
								num3 = Program.fMinDistance + Program.objAppProperties.HeightConfig.fBaseHeight_m;
								Program.ConvertMetersToFeetInch(num3, out num4, out num5);
								if (num3 < Program.objAppProperties.HeightConfig.fAlarmHeight_m && Program.enumCurrentLoggingMode != enLoggingMode.Auto_Obj_Detection)
								{
									Program.bAlarmFlag = true;
								}
								if (Program.bMetricUnits)
								{
									Program.sLsrThreadMinString = num3.ToString("F2") + " m";
								}
								else
								{
									Program.sLsrThreadMinString = num4.ToString("D") + " ft " + num5.ToString("F1") + " in";
								}
								Program.sLsrThreadIntString = num2.ToString("D");
								Program.objGpsDataLock.AcquireReaderLock(5);
								try
								{
									Program.sLsrGpsLongitude = Program.FormatGpsLongitude();
									Program.sLsrGpsLatitude = Program.FormatGpsLatitude();
									Program.sLsrGpsSats = Program.FormatGpsSats();
									Program.fGpsLatitudePingDecDeg = Program.fGpsLatitudeDecDeg;
									Program.fGpsLongitudePingDecDeg = Program.fGpsLongitudeDecDeg;
								}
								finally
								{
									Program.objGpsDataLock.ReleaseReaderLock();
								}
							}
							if (Program.enumCurrentLoggingMode == enLoggingMode.Auto_Obj_Detection && Program.bLoggingFlag)
							{
								if (((num + Program.objAppProperties.HeightConfig.fBaseHeight_m > Program.objAppProperties.HeightConfig.fMaxHeight_m && num2 > Program.objAppProperties.LaserDataConfig.iIntensityThreshold && num > Program.objAppProperties.LaserDataConfig.fDistanceThreshold_m) || num <= Program.objAppProperties.LaserDataConfig.fDistanceThreshold_m || num2 <= Program.objAppProperties.LaserDataConfig.iIntensityThreshold) && Program.fMinDistance + Program.objAppProperties.HeightConfig.fBaseHeight_m <= Program.objAppProperties.HeightConfig.fMaxHeight_m)
								{
									Program.DetectObjectCounterIncrement();
								}
								else
								{
									Program.DetectObjectCounterReset();
								}
							}
							else
							{
								Program.DetectObjectCounterReset();
							}
							bool flag = Program.enumCurrentLoggingMode == enLoggingMode.Log_All_Data;
							bool flag2 = Program.enumCurrentLoggingMode == enLoggingMode.Auto_Obj_Detection && Program.iObjectDetectionCounter >= 10;
							if (Program.iDisplayUpdateCounter > Program.iDisplayUpdateRollover)
							{
								int num6;
								double num7;
								Program.ConvertMetersToFeetInch(num, out num6, out num7);
								Program.sTimeStampDisplay = laserDataItem.sTimeStamp;
								Program.sLaserDataDisplayString = string.Concat(new string[]
								{
									"D ",
									num.ToString("F2"),
									" m (",
									(num / 0.0254).ToString("F1"),
									" in = ",
									num6.ToString("D"),
									" ft, ",
									num7.ToString("F1"),
									" in), I ",
									num2.ToString("D")
								});
								if (Program.bMetricUnits)
								{
									Program.sMinimumHeightDisplayString = num3.ToString("F2") + " m";
								}
								else
								{
									Program.sMinimumHeightDisplayString = num4.ToString("D") + " ft, " + num5.ToString("F1") + " in";
								}
								Program.iDisplayUpdateCounter = 0;
								if (Program.bLoggingFlag && Program.sLsrThreadMinString != "")
								{
									Program.a1sLogStrings[0] = Program.sLsrGpsLongitude;
									Program.a1sLogStrings[1] = Program.sLsrGpsLatitude;
									Program.a1sLogStrings[2] = Program.sLsrThreadMinString;
									Program.a1sLogStrings[3] = (string)Program.frmMainForm.Invoke(Program.frmMainForm.GetObstruction);
									Program.a1sLogStrings[4] = (string)Program.frmMainForm.Invoke(Program.frmMainForm.GetNotes);
									Program.a1sLogStrings[5] = laserDataItem.sTimeStamp;
									Program.a1sLogStrings[6] = Program.sLsrGpsSats;
									Program.a1sLogStrings[7] = Program.sLsrThreadIntString;
									Program.a1sLogStrings[8] = (string)Program.frmMainForm.Invoke(Program.frmMainForm.GetTemperature);
									Program.a1sLogStrings[9] = (string)Program.frmMainForm.Invoke(Program.frmMainForm.GetRouteSegment);
									if (flag && (!Program.objAppProperties.AppConfig.bRequireGps || (Program.objAppProperties.AppConfig.bRequireGps && Program.iGpsNumSats >= 3)))
									{
										Program.QueueLogEntry(Program.a1sLogStrings[0], Program.a1sLogStrings[1], Program.a1sLogStrings[2], Program.a1sLogStrings[3], Program.a1sLogStrings[4], Program.a1sLogStrings[5], Program.a1sLogStrings[6], Program.a1sLogStrings[7], Program.a1sLogStrings[8], Program.a1sLogStrings[9]);
										Program.bNotificationFlag = true;
									}
									Program.sLsrThreadMinString = "";
									Program.sLsrThreadIntString = "";
									Program.sLsrGpsLongitude = "";
									Program.sLsrGpsLatitude = "";
									Program.sLsrGpsSats = "";
								}
							}
							else
							{
								Program.iDisplayUpdateCounter++;
							}
							if (Program.bLoggingFlag && Program.a1sLogStrings[2] != "" && flag2 && (!Program.objAppProperties.AppConfig.bRequireGps || (Program.objAppProperties.AppConfig.bRequireGps && Program.iGpsNumSats >= 3)))
							{
								Program.QueueLogEntry(Program.a1sLogStrings[0], Program.a1sLogStrings[1], Program.a1sLogStrings[2], Program.a1sLogStrings[3], Program.a1sLogStrings[4], Program.a1sLogStrings[5], Program.a1sLogStrings[6], Program.a1sLogStrings[7], Program.a1sLogStrings[8], Program.a1sLogStrings[9]);
								Program.bNotificationFlag = true;
								Program.ResetMinDistanceNoLog();
							}
						}
						finally
						{
							Program.objLaserDataLock.ReleaseWriterLock();
						}
						continue;
					}
					catch (ApplicationException)
					{
						Console.WriteLine("ProcessLaserDataTask:  Writerlock timed out");
						continue;
					}
				}
				string str = "ErrorCode = ";
				enLaserDataError enumErrorCode = laserDataItem.enumErrorCode;
				Console.WriteLine(str + enumErrorCode.ToString());
				num = (double)(((int)(laserDataItem.a1byteDataBuffer[0] & 127) << 7) + (int)laserDataItem.a1byteDataBuffer[1]) / 100.0;
				int num8 = (int)(laserDataItem.a1byteDataBuffer[2] * 2);
				Console.WriteLine("Distance = " + num.ToString("F3") + " m");
				Console.WriteLine("Intensity = " + num8.ToString("F3"));
				if ((128 & laserDataItem.a1byteDataBuffer[0]) == 0)
				{
					Console.WriteLine("Distance byte 1, bit error (=0).");
				}
				else
				{
					Console.WriteLine("Distance byte 1, bit (=1).");
				}
				if ((128 & laserDataItem.a1byteDataBuffer[1]) != 0)
				{
					Console.WriteLine("Distance byte 0, bit error (=1).");
				}
				else
				{
					Console.WriteLine("Distance byte 0, bit (=0).");
				}
				if ((128 & laserDataItem.a1byteDataBuffer[2]) != 0)
				{
					Console.WriteLine("Intensity byte, bit error (=1).");
				}
				else
				{
					Console.WriteLine("Intensity byte, bit (=0).");
				}
				Console.WriteLine("1st byte received = " + Convert.ToString(laserDataItem.a1byteDataBuffer[0], 2).PadLeft(8, '0'));
				Console.WriteLine("2nd byte received = " + Convert.ToString(laserDataItem.a1byteDataBuffer[1], 2).PadLeft(8, '0'));
				Console.WriteLine("3rd byte received = " + Convert.ToString(laserDataItem.a1byteDataBuffer[2], 2).PadLeft(8, '0'));
				Console.WriteLine("");
			}
		}

		// Token: 0x060000B8 RID: 184 RVA: 0x0000BEC0 File Offset: 0x0000A0C0
		private static void GpsDataReceivedHandler(object Sender, SerialDataReceivedEventArgs e)
		{
			if (!Program.bDataEventHandlersGo)
			{
				return;
			}
			int bytesToRead = Program.objGpsPort.BytesToRead;
			if (bytesToRead >= 1)
			{
				char[] array = new char[bytesToRead];
				Program.objGpsPort.Read(array, 0, bytesToRead);
				Program.objGpsQueue.Add(array);
			}
		}

		// Token: 0x060000B9 RID: 185 RVA: 0x0000BF04 File Offset: 0x0000A104
		public static void ProcessGpsTask()
		{
			foreach (char[] array in Program.objGpsQueue.GetConsumingEnumerable())
			{
				Program.iGpsQueueDepth = Program.objGpsQueue.Count;
				int num = array.Length;
				for (int i = 0; i < num; i++)
				{
					if (!Program.bDataEventHandlersGo)
					{
						return;
					}
					char c = array[i];
					if (c.ToString() == "$")
					{
						Program.iGpsDataIndex = 0;
					}
					else if (c.ToString() == "*")
					{
						Program.iGpsDataIndex = -3;
					}
					else if (Program.iGpsDataIndex == -3)
					{
						Program.a1cGpsChecksum[0] = c;
						Program.iGpsDataIndex++;
					}
					else if (Program.iGpsDataIndex == -2)
					{
						Program.a1cGpsChecksum[1] = c;
						Program.iGpsDataIndex++;
						Program.ParseGpsString(Program.a1cGpsDataBuffer, Program.a1cGpsChecksum);
					}
					else if (Program.iGpsDataIndex >= 0)
					{
						Program.a1cGpsDataBuffer[Program.iGpsDataIndex] = c;
						Program.iGpsDataIndex++;
					}
				}
			}
		}

		// Token: 0x060000BA RID: 186 RVA: 0x0000C038 File Offset: 0x0000A238
		private static void ParseGpsString(char[] a1cDataBuffer, char[] a1cChecksum)
		{
			string text = new string(a1cDataBuffer);
			string s = new string(a1cChecksum);
			try
			{
				int.Parse(s, NumberStyles.HexNumber);
			}
			catch
			{
				Program.sGpsDataDisplayString = "ERROR(0) parsing GPS message";
				return;
			}
			if (text.StartsWith("GPGGA") || text.StartsWith("GPRMC") || text.StartsWith("GNGGA") || text.StartsWith("GNRMC"))
			{
				try
				{
					string[] array = text.Split(new char[]
					{
						','
					});
					if (text.StartsWith("GPGGA") || text.StartsWith("GNGGA"))
					{
						Program.fTmpGpsLatitudeDeg = Math.Floor(Convert.ToDouble(array[2]) / 100.0);
						Program.fTmpGpsLatitudeMin = Convert.ToDouble(array[2]) % 100.0;
						Program.sTmpGpsLatitudeDir = array[3];
						Program.fTmpGpsLongitudeDeg = Math.Floor(Convert.ToDouble(array[4]) / 100.0);
						Program.fTmpGpsLongitudeMin = Convert.ToDouble(array[4]) % 100.0;
						Program.sTmpGpsLongitudeDir = array[5];
						Program.iTmpGpsNumSats = Convert.ToInt32(array[7]);
						if (Convert.ToDouble(array[1]) != Program.fTmpGpsTimeStamp)
						{
							Program.fTmpGpsTimeStamp = Convert.ToDouble(array[1]);
							Program.fTmpGpsKnots = 0.0;
						}
						else
						{
							Program.objGpsDataLock.AcquireWriterLock(5);
							try
							{
								Program.fGpsLatitudeDeg = Program.fTmpGpsLatitudeDeg;
								Program.fGpsLatitudeMin = Program.fTmpGpsLatitudeMin;
								Program.sGpsLatitudeDir = Program.sTmpGpsLatitudeDir;
								Program.fGpsLongitudeDeg = Program.fTmpGpsLongitudeDeg;
								Program.fGpsLongitudeMin = Program.fTmpGpsLongitudeMin;
								Program.sGpsLongitudeDir = Program.sTmpGpsLongitudeDir;
								Program.iGpsNumSats = Program.iTmpGpsNumSats;
								Program.fGpsKnots = Program.fTmpGpsKnots;
								Program.fGpsTimeStamp = Program.fTmpGpsTimeStamp;
								Program.fGpsLatitudeDecDeg = Program.GpsConvertToSignedDecDeg(Program.fGpsLatitudeDeg + Program.fGpsLatitudeMin / 60.0, Program.sGpsLatitudeDir);
								Program.fGpsLongitudeDecDeg = Program.GpsConvertToSignedDecDeg(Program.fGpsLongitudeDeg + Program.fTmpGpsLongitudeMin / 60.0, Program.sGpsLongitudeDir);
								if (Program.objAppProperties.GpsConfig.bPingEnabled && Program.bLoggingFlag && Program.iGpsNumSats >= 3 && Program.GpsDistanceCalc(Program.fGpsLongitudePingDecDeg, Program.fGpsLatitudePingDecDeg, Program.fGpsLongitudeDecDeg, Program.fGpsLatitudeDecDeg) > (double)Program.objAppProperties.GpsConfig.iPingDistance_ft)
								{
									Program.fGpsLatitudePingDecDeg = Program.fGpsLatitudeDecDeg;
									Program.fGpsLongitudePingDecDeg = Program.fGpsLongitudeDecDeg;
									Program.QueueLogEntry(Program.FormatGpsLongitude(), Program.FormatGpsLatitude(), "", "", "PING", Program.GetTimeStampString(), Program.FormatGpsSats(), "", "", "");
								}
							}
							finally
							{
								Program.objGpsDataLock.ReleaseWriterLock();
							}
							if (text.StartsWith("GN"))
							{
								Program.sGpsDataDisplayString = Program.UpdateGpsField() + ", GNSS enabled";
							}
							else
							{
								Program.sGpsDataDisplayString = Program.UpdateGpsField();
							}
						}
					}
					else
					{
						Program.fTmpGpsKnots = Convert.ToDouble(array[7]);
						if (Convert.ToDouble(array[1]) != Program.fTmpGpsTimeStamp)
						{
							Program.fTmpGpsTimeStamp = Convert.ToDouble(array[1]);
							Program.fTmpGpsLatitudeDeg = 0.0;
							Program.fTmpGpsLatitudeMin = 0.0;
							Program.sTmpGpsLatitudeDir = "None";
							Program.fTmpGpsLongitudeDeg = 0.0;
							Program.fTmpGpsLongitudeMin = 0.0;
							Program.sTmpGpsLongitudeDir = "None";
							Program.iTmpGpsNumSats = 0;
						}
						else
						{
							Program.objGpsDataLock.AcquireWriterLock(5);
							try
							{
								Program.fGpsLatitudeDeg = Program.fTmpGpsLatitudeDeg;
								Program.fGpsLatitudeMin = Program.fTmpGpsLatitudeMin;
								Program.sGpsLatitudeDir = Program.sTmpGpsLatitudeDir;
								Program.fGpsLongitudeDeg = Program.fTmpGpsLongitudeDeg;
								Program.fGpsLongitudeMin = Program.fTmpGpsLongitudeMin;
								Program.sGpsLongitudeDir = Program.sTmpGpsLongitudeDir;
								Program.iGpsNumSats = Program.iTmpGpsNumSats;
								Program.fGpsKnots = Program.fTmpGpsKnots;
								Program.fGpsTimeStamp = Program.fTmpGpsTimeStamp;
								Program.fGpsLatitudeDecDeg = Program.GpsConvertToSignedDecDeg(Program.fGpsLatitudeDeg + Program.fGpsLatitudeMin / 60.0, Program.sGpsLatitudeDir);
								Program.fGpsLongitudeDecDeg = Program.GpsConvertToSignedDecDeg(Program.fGpsLongitudeDeg + Program.fGpsLongitudeMin / 60.0, Program.sGpsLongitudeDir);
								if (Program.objAppProperties.GpsConfig.bPingEnabled && Program.bLoggingFlag && Program.iGpsNumSats >= 3 && Program.GpsDistanceCalc(Program.fGpsLongitudePingDecDeg, Program.fGpsLatitudePingDecDeg, Program.fGpsLongitudeDecDeg, Program.fGpsLatitudeDecDeg) > (double)Program.objAppProperties.GpsConfig.iPingDistance_ft)
								{
									Program.fGpsLatitudePingDecDeg = Program.fGpsLatitudeDecDeg;
									Program.fGpsLongitudePingDecDeg = Program.fGpsLongitudeDecDeg;
									Program.QueueLogEntry(Program.FormatGpsLongitude(), Program.FormatGpsLatitude(), "", "", "PING", Program.GetTimeStampString(), Program.FormatGpsSats(), "", "", "");
								}
							}
							finally
							{
								Program.objGpsDataLock.ReleaseWriterLock();
							}
							if (text.StartsWith("GN"))
							{
								Program.sGpsDataDisplayString = Program.UpdateGpsField() + ", GNSS enabled";
							}
							else
							{
								Program.sGpsDataDisplayString = Program.UpdateGpsField();
							}
						}
					}
				}
				catch
				{
					Program.sGpsDataDisplayString = "ERROR(1) parsing GPS message";
				}
			}
		}

		// Token: 0x060000BB RID: 187 RVA: 0x0000C58C File Offset: 0x0000A78C
		private static string UpdateGpsField()
		{
			Convert.ToString('°');
			Convert.ToString('\'');
			string text;
			if (Program.bMetricUnits)
			{
				text = (Program.fGpsKnots * 1.852).ToString("F0") + " kph";
			}
			else
			{
				text = (Program.fGpsKnots * 1.15078).ToString("F0") + " mph";
			}
			return string.Concat(new string[]
			{
				Program.fGpsTimeStamp.ToString("F1"),
				": Long ",
				Program.FormatGpsLongitude(),
				", Lat ",
				Program.FormatGpsLatitude(),
				", ",
				text,
				", ",
				Program.iGpsNumSats.ToString("D"),
				" satellites"
			});
		}

		// Token: 0x060000BC RID: 188 RVA: 0x0000C670 File Offset: 0x0000A870
		private static string FormatGpsLongitude()
		{
			string text = Convert.ToChar(176).ToString();
			string text2 = Convert.ToChar(39).ToString();
			string text3 = Convert.ToChar(34).ToString();
			int num = 1;
			if (Program.sGpsLongitudeDir == "W")
			{
				num = -1;
			}
			string result;
			if (Program.objAppProperties.GpsConfig.enumGpsDataFormat == enGpsDataFormat.Decimal_Degrees)
			{
				result = Program.GpsConvertToSignedDecDeg(Program.fGpsLongitudeDeg + Program.fGpsLongitudeMin / 60.0, Program.sGpsLongitudeDir).ToString("F6") + text;
			}
			else if (Program.objAppProperties.GpsConfig.enumGpsDataFormat == enGpsDataFormat.Degrees_Minutes_Seconds)
			{
				int num2 = (int)Program.fGpsLongitudeMin;
				double num3 = (Program.fGpsLongitudeMin - (double)num2) * 60.0;
				result = string.Concat(new string[]
				{
					Program.fGpsLongitudeDeg.ToString("F0"),
					text,
					" ",
					num2.ToString("D"),
					text2,
					" ",
					num3.ToString("F3"),
					text3,
					" ",
					Program.sGpsLongitudeDir
				});
			}
			else if (Program.objAppProperties.GpsConfig.enumGpsDataFormat == enGpsDataFormat.Degrees_And_Decimal_Minutes)
			{
				result = string.Concat(new string[]
				{
					(Program.fGpsLongitudeDeg * (double)num).ToString("F0"),
					text,
					" ",
					Program.fGpsLongitudeMin.ToString("F4"),
					text2
				});
			}
			else
			{
				result = Program.sGpsLongitudeDir + Program.fGpsLongitudeDeg.ToString("F0") + " " + Program.fGpsLongitudeMin.ToString("F4");
			}
			return result;
		}

		// Token: 0x060000BD RID: 189 RVA: 0x0000C844 File Offset: 0x0000AA44
		private static string FormatGpsLatitude()
		{
			string text = Convert.ToChar(176).ToString();
			string text2 = Convert.ToChar(39).ToString();
			string text3 = Convert.ToChar(34).ToString();
			int num = 1;
			if (Program.sGpsLatitudeDir == "S")
			{
				num = -1;
			}
			string result;
			if (Program.objAppProperties.GpsConfig.enumGpsDataFormat == enGpsDataFormat.Decimal_Degrees)
			{
				result = Program.GpsConvertToSignedDecDeg(Program.fGpsLatitudeDeg + Program.fGpsLatitudeMin / 60.0, Program.sGpsLatitudeDir).ToString("F6") + text;
			}
			else if (Program.objAppProperties.GpsConfig.enumGpsDataFormat == enGpsDataFormat.Degrees_Minutes_Seconds)
			{
				int num2 = (int)Program.fGpsLatitudeMin;
				double num3 = (Program.fGpsLatitudeMin - (double)num2) * 60.0;
				result = string.Concat(new string[]
				{
					Program.fGpsLatitudeDeg.ToString("F0"),
					text,
					" ",
					num2.ToString("D"),
					text2,
					" ",
					num3.ToString("F3"),
					text3,
					" ",
					Program.sGpsLatitudeDir
				});
			}
			else if (Program.objAppProperties.GpsConfig.enumGpsDataFormat == enGpsDataFormat.Degrees_And_Decimal_Minutes)
			{
				result = string.Concat(new string[]
				{
					(Program.fGpsLatitudeDeg * (double)num).ToString("F0"),
					text,
					" ",
					Program.fGpsLatitudeMin.ToString("F4"),
					text2
				});
			}
			else
			{
				result = Program.sGpsLatitudeDir + Program.fGpsLatitudeDeg.ToString("F0") + " " + Program.fGpsLatitudeMin.ToString("F4");
			}
			return result;
		}

		// Token: 0x060000BE RID: 190 RVA: 0x0000CA15 File Offset: 0x0000AC15
		private static string FormatGpsSats()
		{
			return Program.iGpsNumSats.ToString("D");
		}

		// Token: 0x060000BF RID: 191 RVA: 0x0000CA28 File Offset: 0x0000AC28
		private static double GpsConvertToSignedDecDeg(double AngleUnsigned, string Direction)
		{
			double result;
			if (Direction == "N" || Direction == "E")
			{
				result = AngleUnsigned;
			}
			else
			{
				result = -1.0 * AngleUnsigned;
			}
			return result;
		}

		// Token: 0x060000C0 RID: 192 RVA: 0x0000CA60 File Offset: 0x0000AC60
		private static double GpsDistanceCalc(double fLong1DecDeg, double fLat1DecDeg, double fLong2DecDeg, double fLat2DecDeg)
		{
			int num = 20903520;
			double num2 = fLong1DecDeg * 3.1415926 / 180.0;
			double num3 = fLong2DecDeg * 3.1415926 / 180.0;
			double num4 = fLat1DecDeg * 3.1415926 / 180.0;
			double num5 = fLat2DecDeg * 3.1415926 / 180.0;
			double num6 = num3 - num2;
			if (num6 > 3.1415926)
			{
				num6 = 360.0 - num6;
			}
			double num7 = num6 * Math.Cos((num5 + num4) / 2.0);
			double num8 = num5 - num4;
			return Math.Sqrt(num7 * num7 + num8 * num8) * (double)num;
		}

		// Token: 0x060000C1 RID: 193 RVA: 0x0000CB14 File Offset: 0x0000AD14
		public static void LogUserNotes(string ObstructionString, string NoteString)
		{
			bool flag = false;
			Program.objGpsDataLock.AcquireReaderLock(5);
			string sLongitude;
			string sLatitude;
			string sGpsSats;
			try
			{
				sLongitude = Program.FormatGpsLongitude();
				sLatitude = Program.FormatGpsLatitude();
				sGpsSats = Program.FormatGpsSats();
				flag = true;
			}
			finally
			{
				Program.objGpsDataLock.ReleaseReaderLock();
			}
			string sTemperature = (string)Program.frmMainForm.Invoke(Program.frmMainForm.GetTemperature);
			string sRoute = (string)Program.frmMainForm.Invoke(Program.frmMainForm.GetRouteSegment);
			if (flag)
			{
				Program.QueueLogEntry(sLongitude, sLatitude, "", ObstructionString, NoteString, Program.GetTimeStampString(), sGpsSats, "", sTemperature, sRoute);
			}
		}

		// Token: 0x060000C2 RID: 194 RVA: 0x0000CBB8 File Offset: 0x0000ADB8
		public static bool ManualLogEntry(string sObstructionString, string sNoteString, string sTemperature, string sRoute)
		{
			bool flag = false;
			string[] array = new string[10];
			Program.objLaserDataLock.AcquireReaderLock(5);
			try
			{
				array[0] = Program.a1sLogStrings[0];
				array[1] = Program.a1sLogStrings[1];
				array[2] = Program.a1sLogStrings[2];
				array[3] = Program.a1sLogStrings[3];
				array[4] = Program.a1sLogStrings[4];
				array[5] = Program.a1sLogStrings[5];
				array[6] = Program.a1sLogStrings[6];
				array[7] = Program.a1sLogStrings[7];
				array[8] = Program.a1sLogStrings[8];
				array[9] = Program.a1sLogStrings[9];
				Program.ResetMinDistanceNoLog();
				flag = true;
			}
			finally
			{
				Program.objLaserDataLock.ReleaseReaderLock();
			}
			if (flag && (array[2] != "" || sObstructionString != "" || sNoteString != ""))
			{
				Program.QueueLogEntry(array[0], array[1], array[2], sObstructionString, sNoteString, Program.GetTimeStampString(), array[6], array[7], sTemperature, sRoute);
				return true;
			}
			return false;
		}

		// Token: 0x040000DF RID: 223
		public const string sVersion = "1.0.11";

		// Token: 0x040000E0 RID: 224
		public const int iNUM_DATA_COLUMN = 11;

		// Token: 0x040000E1 RID: 225
		public const double fPI = 3.1415926;

		// Token: 0x040000E2 RID: 226
		public const string sDEFAULT_LASER_PORT = "COM1";

		// Token: 0x040000E3 RID: 227
		public const string sDEFAULT_GPS_PORT = "COM2";

		// Token: 0x040000E4 RID: 228
		public static SerialPort objLaserPort;

		// Token: 0x040000E5 RID: 229
		public static SerialPort objGpsPort;

		// Token: 0x040000E6 RID: 230
		private static MainForm frmMainForm;

		// Token: 0x040000E7 RID: 231
		private static AppProperties objAppProperties = new AppProperties();

		// Token: 0x040000E8 RID: 232
		private static string sTimeStampDisplay = "";

		// Token: 0x040000E9 RID: 233
		private static string sLaserDataDisplayString = "";

		// Token: 0x040000EA RID: 234
		private static string sMinimumHeightDisplayString = "";

		// Token: 0x040000EB RID: 235
		private static string sGpsDataDisplayString = "";

		// Token: 0x040000EC RID: 236
		private static volatile bool bLoggingFlag = false;

		// Token: 0x040000ED RID: 237
		private static double fMinDistance = 30.0;

		// Token: 0x040000EE RID: 238
		private static string sLogFileName = Program.CreateLogFileName();

		// Token: 0x040000EF RID: 239
		private static string sAppSettingsFile = "Vertical_Clearance_Measurement_App_Settings.json";

		// Token: 0x040000F0 RID: 240
		private static bool bMetricUnits = false;

		// Token: 0x040000F1 RID: 241
		private static string[] a1sLogStrings = Enumerable.Repeat<string>("", 10).ToArray<string>();

		// Token: 0x040000F2 RID: 242
		private static char[] a1cGpsDataBuffer = new char[85];

		// Token: 0x040000F3 RID: 243
		private static int iGpsDataIndex = -1;

		// Token: 0x040000F4 RID: 244
		private static char[] a1cGpsChecksum = new char[2];

		// Token: 0x040000F5 RID: 245
		private static double fGpsTimeStamp = 0.0;

		// Token: 0x040000F6 RID: 246
		private static double fTmpGpsTimeStamp = 0.0;

		// Token: 0x040000F7 RID: 247
		private static double fGpsLatitudeDeg = 0.0;

		// Token: 0x040000F8 RID: 248
		private static double fGpsLatitudeMin = 0.0;

		// Token: 0x040000F9 RID: 249
		private static double fTmpGpsLatitudeDeg = 0.0;

		// Token: 0x040000FA RID: 250
		private static double fTmpGpsLatitudeMin = 0.0;

		// Token: 0x040000FB RID: 251
		private static double fGpsLongitudeDeg = 0.0;

		// Token: 0x040000FC RID: 252
		private static double fGpsLongitudeMin = 0.0;

		// Token: 0x040000FD RID: 253
		private static double fTmpGpsLongitudeDeg = 0.0;

		// Token: 0x040000FE RID: 254
		private static double fTmpGpsLongitudeMin = 0.0;

		// Token: 0x040000FF RID: 255
		private static double fGpsLongitudeDecDeg = 0.0;

		// Token: 0x04000100 RID: 256
		private static double fGpsLatitudeDecDeg = 0.0;

		// Token: 0x04000101 RID: 257
		private static string sGpsLatitudeDir = "";

		// Token: 0x04000102 RID: 258
		private static string sGpsLongitudeDir = "";

		// Token: 0x04000103 RID: 259
		private static string sTmpGpsLatitudeDir = "";

		// Token: 0x04000104 RID: 260
		private static string sTmpGpsLongitudeDir = "";

		// Token: 0x04000105 RID: 261
		private static double fGpsKnots = 0.0;

		// Token: 0x04000106 RID: 262
		private static double fTmpGpsKnots = 0.0;

		// Token: 0x04000107 RID: 263
		private static int iGpsNumSats = 0;

		// Token: 0x04000108 RID: 264
		private static int iTmpGpsNumSats = 0;

		// Token: 0x04000109 RID: 265
		private static double fGpsLongitudePingDecDeg = 0.0;

		// Token: 0x0400010A RID: 266
		private static double fGpsLatitudePingDecDeg = 0.0;

		// Token: 0x0400010B RID: 267
		private static ReaderWriterLock objGpsDataLock = new ReaderWriterLock();

		// Token: 0x0400010C RID: 268
		private static ReaderWriterLock objLaserDataLock = new ReaderWriterLock();

		// Token: 0x0400010D RID: 269
		private const int iLOCK_TIMEOUT = 5;

		// Token: 0x0400010E RID: 270
		private const int iPACKET_BYTES = 3;

		// Token: 0x0400010F RID: 271
		private static BlockingCollection<string> objLoggingQueue = new BlockingCollection<string>();

		// Token: 0x04000110 RID: 272
		private static BlockingCollection<char[]> objGpsQueue = new BlockingCollection<char[]>();

		// Token: 0x04000111 RID: 273
		private static BlockingCollection<LaserDataItem> objLaserQueue = new BlockingCollection<LaserDataItem>();

		// Token: 0x04000112 RID: 274
		private static int iGpsQueueDepth = 0;

		// Token: 0x04000113 RID: 275
		private static int iLaserQueueDepth = 0;

		// Token: 0x04000114 RID: 276
		private static int iDisplayUpdateCounter = 0;

		// Token: 0x04000115 RID: 277
		private static int iDisplayUpdateRollover = 1000;

		// Token: 0x04000116 RID: 278
		private static string sLsrThreadMinString = "";

		// Token: 0x04000117 RID: 279
		private static string sLsrThreadIntString = "";

		// Token: 0x04000118 RID: 280
		private static string sLsrGpsLongitude = "";

		// Token: 0x04000119 RID: 281
		private static string sLsrGpsLatitude = "";

		// Token: 0x0400011A RID: 282
		private static string sLsrGpsSats = "";

		// Token: 0x0400011B RID: 283
		private static bool bAlarmFlag = false;

		// Token: 0x0400011C RID: 284
		private static bool bNotificationFlag = false;

		// Token: 0x0400011D RID: 285
		private static bool bComSettingsAbort = false;

		// Token: 0x0400011E RID: 286
		private static bool bDataEventHandlersGo = false;

		// Token: 0x0400011F RID: 287
		private static bool bComPortsValidFlag = true;

		// Token: 0x04000120 RID: 288
		private static enLoggingMode enumCurrentLoggingMode;

		// Token: 0x04000121 RID: 289
		private static int iObjectDetectionCounter = 0;

		// Token: 0x04000122 RID: 290
		private const int iOBJ_DETECT_COUNT_MAX = 10;

		// Token: 0x04000123 RID: 291
		private const double fLASER_MAX_RANGE_M = 30.0;

		// Token: 0x04000124 RID: 292
		private const double fMAX_HEIGHT_MIN_INTERVAL = 0.1;
	}
}
