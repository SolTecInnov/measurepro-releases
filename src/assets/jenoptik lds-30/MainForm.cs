using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Media;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace RSA_Laser_Test_App
{
	// Token: 0x0200000D RID: 13
	public partial class MainForm : Form
	{
		// Token: 0x0600004F RID: 79 RVA: 0x00005550 File Offset: 0x00003750
		public MainForm()
		{
			this.InitializeComponent();
			this.GetNotes = new MainForm.GetStringDelegate(this.GetNotesText);
			this.GetObstruction = new MainForm.GetStringDelegate(this.GetObstructionText);
			this.GetTemperature = new MainForm.GetStringDelegate(this.GetTemperatureText);
			this.GetRouteSegment = new MainForm.GetStringDelegate(this.GetRouteSegmentText);
			this.AddLogEntryList = new MainForm.UpdateStringDelegate(this.AddLogListBox);
			Program.SetMainFormControl(this);
			this.txtbxMinHeightMeas.Text = "*****";
			base.FormClosing += this.MainForm_FormClosing;
			MainForm.bLaserQueueEmptying = false;
			this.lblGpsQueueDepth.Visible = true;
			this.lblGpsQueueDepth.ForeColor = Color.DarkGray;
			this.lblLaserQueueDepth.Visible = true;
			this.lblLaserQueueDepth.ForeColor = Color.DarkGray;
			if (Program.GetMetricFlag())
			{
				this.txtbxBaseHeight.Text = Program.GetBaseHeight().ToString("F3") + " m (set)";
				this.txtbxAlarmHeight.Text = Program.GetAlarmHeight().ToString("F3") + " m (set)";
				this.txtbxMaxHeight.Text = Program.GetMaxHeight().ToString("F3") + " m (set)";
			}
			else
			{
				this.txtbxBaseHeight.Text = (Program.GetBaseHeight() / 0.0254).ToString("F2") + " in (set)";
				this.txtbxAlarmHeight.Text = (Program.GetAlarmHeight() / 0.0254).ToString("F2") + " in (set)";
				this.txtbxMaxHeight.Text = (Program.GetMaxHeight() / 0.0254).ToString("F2") + " in (set)";
			}
			int num;
			double num2;
			Program.ConvertMetersToFeetInch(Program.GetBaseHeight(), out num, out num2);
			this.txtbxBaseHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num.ToString("D"),
				" ft, ",
				num2.ToString("F2"),
				" in"
			});
			Program.ConvertMetersToFeetInch(Program.GetAlarmHeight(), out num, out num2);
			this.txtbxAlarmHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num.ToString("D"),
				" ft, ",
				num2.ToString("F2"),
				" in"
			});
			Program.ConvertMetersToFeetInch(Program.GetMaxHeight(), out num, out num2);
			this.txtbxMaxHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num.ToString("D"),
				" ft, ",
				num2.ToString("F2"),
				" in"
			});
			this.cmbobxCurrentLoggingMode.Items.Clear();
			this.cmbobxCurrentLoggingMode.Items.Add(enLoggingMode.Manual_Logging.ToString());
			this.cmbobxCurrentLoggingMode.Items.Add(enLoggingMode.Auto_Obj_Detection.ToString());
			this.cmbobxCurrentLoggingMode.Items.Add(enLoggingMode.Log_All_Data.ToString());
			this.cmbobxCurrentLoggingMode.Text = Program.AppPropertiesObject.AppConfig.enumDefaultLoggingMode.ToString();
			if (Program.AppPropertiesObject.AppConfig.enumDefaultLoggingMode == enLoggingMode.Manual_Logging)
			{
				this.ManualLoggingUi();
			}
			else if (Program.AppPropertiesObject.AppConfig.enumDefaultLoggingMode == enLoggingMode.Auto_Obj_Detection)
			{
				this.AutoLoggingUi();
			}
			else
			{
				this.LogAllDataUi();
			}
			this.cmbobxObstructionType.Items.Clear();
			this.lstObstructionList.Clear();
			if (File.Exists(MainForm.sObstructionListFile))
			{
				string[] array = File.ReadAllLines(MainForm.sObstructionListFile);
				bool flag = false;
				MainForm.iDefaultObstructionTypeStartIndex = 0;
				for (int i = 0; i < array.Length; i++)
				{
					if (i == 0)
					{
						if (array[i] != "")
						{
							flag = false;
							this.cmbobxObstructionType.Items.Add("<blank> (" + this.a1sObstructionKeymapArray[i] + ")");
							this.lstObstructionList.Add("");
							MainForm.iDefaultObstructionTypeStartIndex++;
							this.cmbobxObstructionType.Items.Add(array[i] + " (" + this.a1sObstructionKeymapArray[i + 1] + ")");
							this.lstObstructionList.Add(array[i]);
							MainForm.iDefaultObstructionTypeStartIndex++;
						}
						else
						{
							flag = true;
							this.cmbobxObstructionType.Items.Add("<blank> (" + this.a1sObstructionKeymapArray[i] + ")");
							this.lstObstructionList.Add(array[i]);
							MainForm.iDefaultObstructionTypeStartIndex++;
						}
					}
					else if (i > 0 && array[i] != "")
					{
						int num3;
						if (!flag)
						{
							num3 = i + 1;
						}
						else
						{
							num3 = i;
						}
						if (num3 < this.a1sObstructionKeymapArray.Length)
						{
							this.cmbobxObstructionType.Items.Add(array[i] + " (" + this.a1sObstructionKeymapArray[num3] + ")");
						}
						else
						{
							this.cmbobxObstructionType.Items.Add(array[i]);
						}
						this.lstObstructionList.Add(array[i]);
						MainForm.iDefaultObstructionTypeStartIndex++;
					}
				}
			}
			else
			{
				using (StreamWriter streamWriter = new StreamWriter(MainForm.sObstructionListFile, false))
				{
					streamWriter.WriteLine("");
				}
				this.cmbobxObstructionType.Items.Add("");
				this.lstObstructionList.Add("");
				MainForm.iDefaultObstructionTypeStartIndex = 1;
			}
			this.cmbobxObstructionType.SelectedIndex = 0;
			MainForm.iCustomObstructionTypeNumItems = MainForm.iDefaultObstructionTypeStartIndex - 1;
			this.cmbobxObstructionType.Items.Add("Bridge (Alt+B)");
			this.lstObstructionList.Add("Bridge");
			this.cmbobxObstructionType.Items.Add("Fiber Line (Alt+F)");
			this.lstObstructionList.Add("Fiber Line");
			this.cmbobxObstructionType.Items.Add("Light Structure (Alt+L)");
			this.lstObstructionList.Add("Light Structure");
			this.cmbobxObstructionType.Items.Add("Power Line (Alt+P)");
			this.lstObstructionList.Add("Power Line");
			this.cmbobxObstructionType.Items.Add("Sign Bridge (Alt+S)");
			this.lstObstructionList.Add("Sign Bridge");
			this.cmbobxObstructionType.Items.Add("Tree (Alt+T)");
			this.lstObstructionList.Add("Tree");
			this.cmbobxObstructionType.Items.Add("Wire (Alt+W)");
			this.lstObstructionList.Add("Wire");
			base.ActiveControl = this.txtbxNotes;
			this.txtbxRouteSegment.Text = "";
			this.txtbxTemperature.Text = "";
			this.lblInsufficientSatellites.Visible = false;
			this.tooltipLaserTestForm.SetToolTip(this.lblObstructionType, "Blank entry has hotkey Alt+Space.  The first 22 custom obstruction types have hotkeys Alt+F1 through Alt+F12, and Alt+1 through Alt+9, and Alt+0.");
		}

		// Token: 0x06000050 RID: 80 RVA: 0x00005E6C File Offset: 0x0000406C
		private void ManualLoggingUi()
		{
			this.lblAlarmHeight.Visible = true;
			this.btnSetAlarmHeight.Visible = true;
			this.txtbxAlarmHeight.Visible = true;
			this.txtbxAlarmHeight2.Visible = true;
			this.btnResetMinimum.Visible = false;
			this.btnClearAll.Visible = false;
			this.btnManualLogEntry.Visible = true;
			this.btnManualLogEntry.ForeColor = Color.Blue;
		}

		// Token: 0x06000051 RID: 81 RVA: 0x00005EE0 File Offset: 0x000040E0
		private void AutoLoggingUi()
		{
			this.lblAlarmHeight.Visible = false;
			this.btnSetAlarmHeight.Visible = false;
			this.txtbxAlarmHeight.Visible = false;
			this.txtbxAlarmHeight2.Visible = false;
			this.btnResetMinimum.Visible = false;
			this.btnClearAll.Visible = false;
			this.btnManualLogEntry.Visible = true;
			this.btnManualLogEntry.ForeColor = Color.Black;
		}

		// Token: 0x06000052 RID: 82 RVA: 0x00005F54 File Offset: 0x00004154
		private void LogAllDataUi()
		{
			this.lblAlarmHeight.Visible = true;
			this.btnSetAlarmHeight.Visible = true;
			this.txtbxAlarmHeight.Visible = true;
			this.txtbxAlarmHeight2.Visible = true;
			this.btnResetMinimum.Visible = true;
			this.btnClearAll.Visible = true;
			this.btnManualLogEntry.Visible = true;
			this.btnManualLogEntry.ForeColor = Color.Black;
		}

		// Token: 0x06000053 RID: 83 RVA: 0x00005FC8 File Offset: 0x000041C8
		protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
		{
			if (keyData == Keys.F1)
			{
				this.btnResetMinimum.PerformClick();
				return true;
			}
			if (keyData == (Keys)65648)
			{
				this.btnClearAll.PerformClick();
				return true;
			}
			if (keyData == Keys.F2)
			{
				this.btnLogNotes.PerformClick();
				return true;
			}
			if (keyData == (Keys)65649)
			{
				this.btnClearNoteObj.PerformClick();
				return true;
			}
			if (keyData == Keys.F3)
			{
				this.cmbobxObstructionType.Focus();
				this.cmbobxObstructionType.DroppedDown = true;
				return true;
			}
			if (keyData == (Keys)65650)
			{
				this.btnClearObject.PerformClick();
				return true;
			}
			if (keyData == Keys.F4)
			{
				base.ActiveControl = this.txtbxNotes;
				return true;
			}
			if (keyData == (Keys)65651)
			{
				this.txtbxNotes.Text = "";
				return true;
			}
			if (keyData == Keys.F12)
			{
				this.btnResetMinNoLog.PerformClick();
				return true;
			}
			if (keyData == (Keys)65659)
			{
				this.btnClearAllNoLog.PerformClick();
				return true;
			}
			if (keyData == (Keys)262210)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex;
				return true;
			}
			if (keyData == (Keys)262214)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex + 1;
				return true;
			}
			if (keyData == (Keys)262220)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex + 2;
				return true;
			}
			if (keyData == (Keys)262224)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex + 3;
				return true;
			}
			if (keyData == (Keys)262227)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex + 4;
				return true;
			}
			if (keyData == (Keys)262228)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex + 5;
				return true;
			}
			if (keyData == (Keys)262231)
			{
				this.cmbobxObstructionType.SelectedIndex = MainForm.iDefaultObstructionTypeStartIndex + 6;
				return true;
			}
			if (keyData == (Keys.Space | Keys.Alt))
			{
				this.cmbobxObstructionType.SelectedIndex = 0;
				return true;
			}
			if (keyData == (Keys)262256 && MainForm.iCustomObstructionTypeNumItems >= 1)
			{
				this.cmbobxObstructionType.SelectedIndex = 1;
				return true;
			}
			if (keyData == (Keys)262257 && MainForm.iCustomObstructionTypeNumItems >= 2)
			{
				this.cmbobxObstructionType.SelectedIndex = 2;
				return true;
			}
			if (keyData == (Keys)262258 && MainForm.iCustomObstructionTypeNumItems >= 3)
			{
				this.cmbobxObstructionType.SelectedIndex = 3;
				return true;
			}
			if (keyData == (Keys)262259 && MainForm.iCustomObstructionTypeNumItems >= 4)
			{
				this.cmbobxObstructionType.SelectedIndex = 4;
				return true;
			}
			if (keyData == (Keys)262260 && MainForm.iCustomObstructionTypeNumItems >= 5)
			{
				this.cmbobxObstructionType.SelectedIndex = 5;
				return true;
			}
			if (keyData == (Keys)262261 && MainForm.iCustomObstructionTypeNumItems >= 6)
			{
				this.cmbobxObstructionType.SelectedIndex = 6;
				return true;
			}
			if (keyData == (Keys)262262 && MainForm.iCustomObstructionTypeNumItems >= 7)
			{
				this.cmbobxObstructionType.SelectedIndex = 7;
				return true;
			}
			if (keyData == (Keys)262263 && MainForm.iCustomObstructionTypeNumItems >= 8)
			{
				this.cmbobxObstructionType.SelectedIndex = 8;
				return true;
			}
			if (keyData == (Keys)262264 && MainForm.iCustomObstructionTypeNumItems >= 9)
			{
				this.cmbobxObstructionType.SelectedIndex = 9;
				return true;
			}
			if (keyData == (Keys)262265 && MainForm.iCustomObstructionTypeNumItems >= 10)
			{
				this.cmbobxObstructionType.SelectedIndex = 10;
				return true;
			}
			if (keyData == (Keys)262266 && MainForm.iCustomObstructionTypeNumItems >= 11)
			{
				this.cmbobxObstructionType.SelectedIndex = 11;
				return true;
			}
			if (keyData == (Keys)262267 && MainForm.iCustomObstructionTypeNumItems >= 12)
			{
				this.cmbobxObstructionType.SelectedIndex = 12;
				return true;
			}
			if (keyData == (Keys.LButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 13)
			{
				this.cmbobxObstructionType.SelectedIndex = 13;
				return true;
			}
			if (keyData == (Keys.RButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 14)
			{
				this.cmbobxObstructionType.SelectedIndex = 14;
				return true;
			}
			if (keyData == (Keys.LButton | Keys.RButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 15)
			{
				this.cmbobxObstructionType.SelectedIndex = 15;
				return true;
			}
			if (keyData == (Keys.MButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 16)
			{
				this.cmbobxObstructionType.SelectedIndex = 16;
				return true;
			}
			if (keyData == (Keys.LButton | Keys.MButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 17)
			{
				this.cmbobxObstructionType.SelectedIndex = 17;
				return true;
			}
			if (keyData == (Keys.RButton | Keys.MButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 18)
			{
				this.cmbobxObstructionType.SelectedIndex = 18;
				return true;
			}
			if (keyData == (Keys.LButton | Keys.RButton | Keys.MButton | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 19)
			{
				this.cmbobxObstructionType.SelectedIndex = 19;
				return true;
			}
			if (keyData == (Keys.Back | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 20)
			{
				this.cmbobxObstructionType.SelectedIndex = 20;
				return true;
			}
			if (keyData == (Keys.LButton | Keys.Back | Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 21)
			{
				this.cmbobxObstructionType.SelectedIndex = 21;
				return true;
			}
			if (keyData == (Keys.ShiftKey | Keys.Space | Keys.Alt) && MainForm.iCustomObstructionTypeNumItems >= 22)
			{
				this.cmbobxObstructionType.SelectedIndex = 22;
				return true;
			}
			if (keyData == (Keys.LButton | Keys.MButton | Keys.Back | Keys.Alt))
			{
				this.btnManualLogEntry.PerformClick();
				return true;
			}
			return base.ProcessCmdKey(ref msg, keyData);
		}

		// Token: 0x06000054 RID: 84 RVA: 0x00006450 File Offset: 0x00004650
		private void btnLaserStart_Click(object sender, EventArgs e)
		{
			Program.ClearReceiveBuffer();
			Program.SendToLaser("DT");
			MainForm.bLaserQueueEmptying = false;
		}

		// Token: 0x06000055 RID: 85 RVA: 0x00006468 File Offset: 0x00004668
		private void btnLaserStop_Click(object sender, EventArgs e)
		{
			Program.SendToLaser(Convert.ToString('\u001b'));
			if (Program.LaserQueueDepth == 0)
			{
				Thread.Sleep(100);
				this.txtbxCurTimeStamp.Text = "";
				this.txtbxCurLaserData.Text = "";
				this.txtbxCurTimeStamp.BackColor = Control.DefaultBackColor;
				this.txtbxCurLaserData.BackColor = Control.DefaultBackColor;
				Program.LaserDataDisplay = "";
				Program.TimeStampDisplay = "";
				MainForm.bLaserQueueEmptying = false;
				return;
			}
			MainForm.bLaserQueueEmptying = true;
		}

		// Token: 0x06000056 RID: 86 RVA: 0x000064F0 File Offset: 0x000046F0
		private void btnResetMinimum_Click(object sender, EventArgs e)
		{
			Program.ResetMinDistance();
			this.txtbxMinHeightMeas.Text = "*****";
			MainForm.bAlarmTriggered = false;
			Program.HeightNotification = false;
			this.txtbxMinHeightMeas.BackColor = Control.DefaultBackColor;
			this.StopAllSounds();
		}

		// Token: 0x06000057 RID: 87 RVA: 0x00006529 File Offset: 0x00004729
		private void btnResetMinNoLog_Click(object sender, EventArgs e)
		{
			Program.ResetMinDistanceNoLog();
			this.txtbxMinHeightMeas.Text = "*****";
			MainForm.bAlarmTriggered = false;
			Program.HeightNotification = false;
			this.txtbxMinHeightMeas.BackColor = Control.DefaultBackColor;
			this.StopAllSounds();
		}

		// Token: 0x06000058 RID: 88 RVA: 0x00006564 File Offset: 0x00004764
		private void btnClearAll_Click(object sender, EventArgs e)
		{
			Program.ResetMinDistance();
			this.txtbxMinHeightMeas.Text = "*****";
			MainForm.bAlarmTriggered = false;
			Program.HeightNotification = false;
			this.txtbxMinHeightMeas.BackColor = Control.DefaultBackColor;
			this.StopAllSounds();
			this.cmbobxObstructionType.SelectedIndex = 0;
			this.txtbxNotes.Text = "";
		}

		// Token: 0x06000059 RID: 89 RVA: 0x000065C4 File Offset: 0x000047C4
		private void btnClearAllNoLog_Click(object sender, EventArgs e)
		{
			Program.ResetMinDistanceNoLog();
			this.txtbxMinHeightMeas.Text = "*****";
			MainForm.bAlarmTriggered = false;
			Program.HeightNotification = false;
			this.txtbxMinHeightMeas.BackColor = Control.DefaultBackColor;
			this.StopAllSounds();
			this.cmbobxObstructionType.SelectedIndex = 0;
			this.txtbxNotes.Text = "";
		}

		// Token: 0x0600005A RID: 90 RVA: 0x00006624 File Offset: 0x00004824
		private void btnClearObject_Click(object sender, EventArgs e)
		{
			this.cmbobxObstructionType.SelectedIndex = 0;
		}

		// Token: 0x0600005B RID: 91 RVA: 0x00006632 File Offset: 0x00004832
		private void btnClearNoteObj_Click(object sender, EventArgs e)
		{
			this.cmbobxObstructionType.SelectedIndex = 0;
			this.txtbxNotes.Text = "";
		}

		// Token: 0x0600005C RID: 92 RVA: 0x00006650 File Offset: 0x00004850
		private void btnLogStart_Click(object sender, EventArgs e)
		{
			this.StartLogging();
		}

		// Token: 0x0600005D RID: 93 RVA: 0x00006658 File Offset: 0x00004858
		private void StartLogging()
		{
			if (Program.AppPropertiesObject.AppConfig.bUseTemperature && this.txtbxTemperature.Text == "")
			{
				MessageBox.Show("Enter a valid temperature value.", "Unable to start logging", MessageBoxButtons.OK);
				return;
			}
			if (Program.AppPropertiesObject.AppConfig.bUseRouteSegment && this.txtbxRouteSegment.Text == "")
			{
				MessageBox.Show("Enter a valid route segment value.", "Unable to start logging", MessageBoxButtons.OK);
				return;
			}
			if (Program.AppPropertiesObject.AppConfig.bRequireGps && Program.GpsNumberOfSatellites < 3)
			{
				MessageBox.Show("GPS signal not available.", "Unable to start logging", MessageBoxButtons.OK);
				return;
			}
			string text = Program.CreateLogFileName();
			Program.LoggingStart(text);
			this.txtbxLogFilename.Text = text;
			this.txtbxLogFilename.BackColor = Color.LightGreen;
		}

		// Token: 0x0600005E RID: 94 RVA: 0x0000672C File Offset: 0x0000492C
		private void btnLogStop_Click(object sender, EventArgs e)
		{
			Program.LoggingStop();
			this.txtbxLogFilename.Text = "";
			this.txtbxLogFilename.BackColor = Control.DefaultBackColor;
		}

		// Token: 0x0600005F RID: 95 RVA: 0x00006754 File Offset: 0x00004954
		private void btnSetBaseHeight_Click(object sender, EventArgs e)
		{
			double num;
			try
			{
				num = Convert.ToDouble(this.txtbxBaseHeight.Text);
				if (num >= 0.0)
				{
					if (Program.GetMetricFlag())
					{
						Program.SetBaseHeight(num);
						this.txtbxBaseHeight.Text = num.ToString("F3") + " m (set)";
					}
					else
					{
						Program.SetBaseHeight(num * 0.0254);
						this.txtbxBaseHeight.Text = num.ToString("F2") + " in (set)";
					}
				}
				else
				{
					Program.SetBaseHeight(0.0);
					if (Program.GetMetricFlag())
					{
						this.txtbxBaseHeight.Text = "0.000 m (set)";
					}
					else
					{
						this.txtbxBaseHeight.Text = "0.00 in (set)";
					}
				}
			}
			catch (FormatException)
			{
				Program.SetBaseHeight(0.0);
				if (Program.GetMetricFlag())
				{
					this.txtbxBaseHeight.Text = "0.000 m (set)";
				}
				else
				{
					this.txtbxBaseHeight.Text = "0.00 in (set)";
				}
			}
			int num2;
			double num3;
			Program.ConvertMetersToFeetInch(Program.GetBaseHeight(), out num2, out num3);
			this.txtbxBaseHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num2.ToString("D"),
				" ft, ",
				num3.ToString("F2"),
				" in"
			});
			num = Program.GetMaxHeight();
			if (Program.GetMetricFlag())
			{
				this.txtbxMaxHeight.Text = num.ToString("F3") + " m (set)";
			}
			else
			{
				this.txtbxMaxHeight.Text = (num * 39.37).ToString("F2") + " in (set)";
			}
			Program.ConvertMetersToFeetInch(num, out num2, out num3);
			this.txtbxMaxHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num2.ToString("D"),
				" ft, ",
				num3.ToString("F2"),
				" in"
			});
		}

		// Token: 0x06000060 RID: 96 RVA: 0x00006974 File Offset: 0x00004B74
		private void MainForm_Load(object sender, EventArgs e)
		{
		}

		// Token: 0x06000061 RID: 97 RVA: 0x00006978 File Offset: 0x00004B78
		private void btnSetAlarmHeight_Click(object sender, EventArgs e)
		{
			try
			{
				double num = Convert.ToDouble(this.txtbxAlarmHeight.Text);
				if (num >= 0.0)
				{
					if (Program.GetMetricFlag())
					{
						Program.SetAlarmHeight(num);
						this.txtbxAlarmHeight.Text = num.ToString("F3") + " m (set)";
					}
					else
					{
						Program.SetAlarmHeight(num * 0.0254);
						this.txtbxAlarmHeight.Text = num.ToString("F2") + " in (set)";
					}
				}
				else
				{
					Program.SetAlarmHeight(0.0);
					if (Program.GetMetricFlag())
					{
						this.txtbxAlarmHeight.Text = "0.000 m (set)";
					}
					else
					{
						this.txtbxAlarmHeight.Text = "0.00 in (set)";
					}
				}
			}
			catch (FormatException)
			{
				Program.SetAlarmHeight(0.0);
				if (Program.GetMetricFlag())
				{
					this.txtbxAlarmHeight.Text = "0.000 m (set)";
				}
				else
				{
					this.txtbxAlarmHeight.Text = "0.00 in (set)";
				}
			}
			int num2;
			double num3;
			Program.ConvertMetersToFeetInch(Program.GetAlarmHeight(), out num2, out num3);
			this.txtbxAlarmHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num2.ToString("D"),
				" ft, ",
				num3.ToString("F2"),
				" in"
			});
		}

		// Token: 0x06000062 RID: 98 RVA: 0x00006AE4 File Offset: 0x00004CE4
		private void btnSetMaxHeight_Click(object sender, EventArgs e)
		{
			try
			{
				double num = Convert.ToDouble(this.txtbxMaxHeight.Text);
				if (num >= 0.0)
				{
					if (Program.GetMetricFlag())
					{
						Program.SetMaxHeight(num);
						this.txtbxMaxHeight.Text = Program.GetMaxHeight().ToString("F3") + " m (set)";
					}
					else
					{
						Program.SetMaxHeight(num * 0.0254);
						this.txtbxMaxHeight.Text = (Program.GetMaxHeight() * 39.37).ToString("F2") + " in (set)";
					}
				}
				else
				{
					Program.SetMaxHeight(0.0);
					if (Program.GetMetricFlag())
					{
						this.txtbxMaxHeight.Text = Program.GetMaxHeight().ToString("F3") + " m (set)";
					}
					else
					{
						this.txtbxMaxHeight.Text = (Program.GetMaxHeight() * 39.37).ToString("F2") + " in (set)";
					}
				}
			}
			catch (FormatException)
			{
				Program.SetMaxHeight(0.0);
				if (Program.GetMetricFlag())
				{
					this.txtbxMaxHeight.Text = Program.GetMaxHeight().ToString("F3") + " m (set)";
				}
				else
				{
					this.txtbxMaxHeight.Text = (Program.GetMaxHeight() * 39.37).ToString("F2") + " in (set)";
				}
			}
			int num2;
			double num3;
			Program.ConvertMetersToFeetInch(Program.GetMaxHeight(), out num2, out num3);
			this.txtbxMaxHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num2.ToString("D"),
				" ft, ",
				num3.ToString("F2"),
				" in"
			});
		}

		// Token: 0x06000063 RID: 99 RVA: 0x00006CE4 File Offset: 0x00004EE4
		private void btnChgUnits_Click(object sender, EventArgs e)
		{
			Program.SetMetricFlag(!Program.GetMetricFlag());
			if (Program.GetMetricFlag())
			{
				this.txtbxBaseHeight.Text = Program.GetBaseHeight().ToString("F3") + " m (set)";
				this.txtbxAlarmHeight.Text = Program.GetAlarmHeight().ToString("F3") + " m (set)";
				this.txtbxMaxHeight.Text = Program.GetMaxHeight().ToString("F3") + " m (set)";
				return;
			}
			this.txtbxBaseHeight.Text = (Program.GetBaseHeight() / 0.0254).ToString("F2") + " in (set)";
			this.txtbxAlarmHeight.Text = (Program.GetAlarmHeight() / 0.0254).ToString("F2") + " in (set)";
			this.txtbxMaxHeight.Text = (Program.GetMaxHeight() / 0.0254).ToString("F2") + " in (set)";
		}

		// Token: 0x06000064 RID: 100 RVA: 0x00006E0E File Offset: 0x0000500E
		private void MainForm_FormClosing(object sender, FormClosingEventArgs e)
		{
			Program.CloseComPorts();
		}

		// Token: 0x06000065 RID: 101 RVA: 0x00006E15 File Offset: 0x00005015
		private void btnClearNotes_Click(object sender, EventArgs e)
		{
			this.txtbxNotes.Text = "";
		}

		// Token: 0x06000066 RID: 102 RVA: 0x00006E28 File Offset: 0x00005028
		private void btnLogNotes_Click(object sender, EventArgs e)
		{
			string notesText = this.GetNotesText();
			if (notesText != "" || this.cmbobxObstructionType.SelectedIndex > 0)
			{
				if (!Program.LoggingStatus())
				{
					this.StartLogging();
				}
				Program.LogUserNotes(this.GetObstructionText(), notesText);
			}
		}

		// Token: 0x06000067 RID: 103 RVA: 0x00006E70 File Offset: 0x00005070
		private void btnManualLogEntry_Click(object sender, EventArgs e)
		{
			if (Program.ManualLogEntry(this.GetObstructionText(), this.GetNotesText(), this.txtbxTemperature.Text, this.txtbxRouteSegment.Text))
			{
				this.txtbxMinHeightMeas.Text = "*****";
				MainForm.bAlarmTriggered = false;
				Program.HeightNotification = true;
				this.txtbxMinHeightMeas.BackColor = Control.DefaultBackColor;
				this.StopAllSounds();
				this.cmbobxObstructionType.SelectedIndex = 0;
				this.txtbxNotes.Text = "";
			}
		}

		// Token: 0x06000068 RID: 104 RVA: 0x00006EF4 File Offset: 0x000050F4
		public string GetNotesText()
		{
			StringBuilder stringBuilder = new StringBuilder(this.txtbxNotes.Text);
			stringBuilder.Replace(",", string.Empty);
			stringBuilder.Replace("\r\n", " ");
			stringBuilder.Replace("\r", " ");
			stringBuilder.Replace("\n", " ");
			stringBuilder.Replace(this.sVerticalTab, " ");
			stringBuilder.Replace(this.sFormFeed, " ");
			stringBuilder.Replace(this.sNextLine, " ");
			stringBuilder.Replace(this.sLineSeparator, " ");
			stringBuilder.Replace(this.sParagraphSeparator, " ");
			return stringBuilder.ToString();
		}

		// Token: 0x06000069 RID: 105 RVA: 0x00006FB4 File Offset: 0x000051B4
		public void AddLogListBox(string NewLine)
		{
			this.lstbxLogEntries.Items.Insert(0, NewLine);
			while (this.lstbxLogEntries.Items.Count > 20)
			{
				this.lstbxLogEntries.Items.RemoveAt(this.lstbxLogEntries.Items.Count - 1);
			}
		}

		// Token: 0x0600006A RID: 106 RVA: 0x0000700B File Offset: 0x0000520B
		public string GetObstructionText()
		{
			return this.lstObstructionList[this.cmbobxObstructionType.SelectedIndex];
		}

		// Token: 0x0600006B RID: 107 RVA: 0x00007023 File Offset: 0x00005223
		public string GetTemperatureText()
		{
			return this.txtbxTemperature.Text;
		}

		// Token: 0x0600006C RID: 108 RVA: 0x00007030 File Offset: 0x00005230
		public string GetRouteSegmentText()
		{
			return this.txtbxRouteSegment.Text;
		}

		// Token: 0x0600006D RID: 109 RVA: 0x00007040 File Offset: 0x00005240
		private void serialPortConfigurationToolStripMenuItem_Click(object sender, EventArgs e)
		{
			SerialPortConfigForm serialPortConfigForm = new SerialPortConfigForm();
			this.txtbxCurTimeStamp.BackColor = Control.DefaultBackColor;
			this.txtbxCurLaserData.BackColor = Control.DefaultBackColor;
			this.txtbxCurGpsData.BackColor = Control.DefaultBackColor;
			this.txtbxLogFilename.Text = "";
			this.txtbxLogFilename.BackColor = Control.DefaultBackColor;
			do
			{
				try
				{
					Program.CloseComPorts();
				}
				catch
				{
				}
				serialPortConfigForm.ShowDialog();
				Program.ComPortsValid = true;
				try
				{
					Program.OpenLaserComPort();
				}
				catch
				{
					Program.ComPortsValid = false;
					MessageBox.Show("Unable to access laser serial port.", "Exception", MessageBoxButtons.OK);
				}
				try
				{
					Program.OpenGpsComPort();
				}
				catch
				{
					Program.ComPortsValid = false;
					MessageBox.Show("Unable to access GPS serial port.", "Exception", MessageBoxButtons.OK);
				}
			}
			while (!Program.ComPortsValid && !Program.ComSettingsAbort);
			if (Program.ComSettingsAbort)
			{
				MessageBox.Show("Could not configure serial ports properly.", "Error: Application Stopped", MessageBoxButtons.OK);
				return;
			}
			Program.DataEventHandlersGo = true;
		}

		// Token: 0x0600006E RID: 110 RVA: 0x00007154 File Offset: 0x00005354
		private void laserFilterParametersToolStripMenuItem_Click(object sender, EventArgs e)
		{
			new LaserMeasFilterForm().ShowDialog();
		}

		// Token: 0x0600006F RID: 111 RVA: 0x00007161 File Offset: 0x00005361
		private void customizeLogFileToolStripMenuItem_Click(object sender, EventArgs e)
		{
			new LogDataFormat().ShowDialog();
		}

		// Token: 0x06000070 RID: 112 RVA: 0x0000716E File Offset: 0x0000536E
		private void optionsToolStripMenuItem_Click(object sender, EventArgs e)
		{
			if (Program.LoggingStatus())
			{
				MessageBox.Show("Stop Logging Before Changing Options", "Alert", MessageBoxButtons.OK);
				return;
			}
			new OptionsForm().ShowDialog();
		}

		// Token: 0x06000071 RID: 113 RVA: 0x00007194 File Offset: 0x00005394
		private void helpToolStripMenuItem_Click(object sender, EventArgs e)
		{
			MessageBox.Show("Vertical Clearance Measurement, v" + Program.Version, "RSA Networks", MessageBoxButtons.OK);
		}

		// Token: 0x06000072 RID: 114 RVA: 0x000071B1 File Offset: 0x000053B1
		private void gPSParametersToolStripMenuItem_Click(object sender, EventArgs e)
		{
			new GpsConfigForm().ShowDialog();
		}

		// Token: 0x06000073 RID: 115 RVA: 0x000071C0 File Offset: 0x000053C0
		private void cmbobxCurrentLoggingMode_SelectedIndexChanged(object sender, EventArgs e)
		{
			Program.HeightNotification = false;
			enLoggingMode enLoggingMode;
			Enum.TryParse<enLoggingMode>(this.cmbobxCurrentLoggingMode.Text, out enLoggingMode);
			Program.CurrentLoggingModeSetting = enLoggingMode;
			if (enLoggingMode == enLoggingMode.Manual_Logging)
			{
				this.ManualLoggingUi();
				return;
			}
			if (enLoggingMode == enLoggingMode.Auto_Obj_Detection)
			{
				this.AutoLoggingUi();
				return;
			}
			this.LogAllDataUi();
		}

		// Token: 0x06000074 RID: 116 RVA: 0x00007208 File Offset: 0x00005408
		private void tmrUpdateFields_Tick(object sender, EventArgs e)
		{
			int gpsNumberOfSatellites = Program.GpsNumberOfSatellites;
			this.txtbxCurTimeStamp.Text = Program.TimeStampDisplay;
			this.txtbxCurLaserData.Text = Program.LaserDataDisplay;
			this.txtbxMinHeightMeas.Text = Program.MinimumHeightDisplay;
			this.txtbxCurGpsData.Text = Program.GpsDataDisplay;
			int gpsQueueDepth = Program.GpsQueueDepth;
			if (gpsQueueDepth > 0)
			{
				this.lblGpsQueueDepth.ForeColor = Color.Black;
				this.lblGpsQueueDepth.BackColor = Color.Red;
			}
			else
			{
				this.lblGpsQueueDepth.ForeColor = Color.DarkGray;
				this.lblGpsQueueDepth.BackColor = Control.DefaultBackColor;
			}
			this.lblGpsQueueDepth.Text = gpsQueueDepth.ToString("D");
			int laserQueueDepth = Program.LaserQueueDepth;
			if (laserQueueDepth > 0)
			{
				this.lblLaserQueueDepth.ForeColor = Color.Black;
				this.lblLaserQueueDepth.BackColor = Color.Red;
			}
			else
			{
				this.lblLaserQueueDepth.ForeColor = Color.DarkGray;
				this.lblLaserQueueDepth.BackColor = Control.DefaultBackColor;
			}
			this.lblLaserQueueDepth.Text = laserQueueDepth.ToString("D");
			if (MainForm.bLaserQueueEmptying && laserQueueDepth == 0)
			{
				MainForm.bLaserQueueEmptying = false;
				this.txtbxCurTimeStamp.Text = "";
				this.txtbxCurLaserData.Text = "";
				this.txtbxCurTimeStamp.BackColor = Control.DefaultBackColor;
				this.txtbxCurLaserData.BackColor = Control.DefaultBackColor;
				Program.LaserDataDisplay = "";
				Program.TimeStampDisplay = "";
			}
			if (this.txtbxCurTimeStamp.Text == "" || (this.txtbxCurTimeStamp.Text != "" && MainForm.bLaserQueueEmptying))
			{
				this.txtbxCurTimeStamp.BackColor = Control.DefaultBackColor;
			}
			else
			{
				this.txtbxCurTimeStamp.BackColor = Color.LightGreen;
			}
			if (this.txtbxCurLaserData.Text == "" || (this.txtbxCurLaserData.Text != "" && MainForm.bLaserQueueEmptying))
			{
				this.txtbxCurLaserData.BackColor = Control.DefaultBackColor;
			}
			else
			{
				this.txtbxCurLaserData.BackColor = Color.LightGreen;
			}
			if (this.txtbxCurGpsData.Text == "")
			{
				this.txtbxCurGpsData.BackColor = Control.DefaultBackColor;
			}
			else
			{
				this.txtbxCurGpsData.BackColor = Color.LightGreen;
			}
			this.lblRouteSegment.Visible = Program.AppPropertiesObject.AppConfig.bUseRouteSegment;
			this.txtbxRouteSegment.Visible = Program.AppPropertiesObject.AppConfig.bUseRouteSegment;
			this.lblTemperature.Visible = Program.AppPropertiesObject.AppConfig.bUseTemperature;
			this.txtbxTemperature.Visible = Program.AppPropertiesObject.AppConfig.bUseTemperature;
			if (!Program.AppPropertiesObject.AppConfig.bUseRouteSegment && this.txtbxRouteSegment.Text != "")
			{
				this.txtbxRouteSegment.Text = "";
			}
			if (!Program.AppPropertiesObject.AppConfig.bUseTemperature && this.txtbxTemperature.Text != "")
			{
				this.txtbxTemperature.Text = "";
			}
			if (gpsNumberOfSatellites < 3 && this.txtbxCurGpsData.Text != "")
			{
				if (Program.AppPropertiesObject.AppConfig.bRequireGps)
				{
					MainForm.bGpsNotification = true;
					this.lblInsufficientSatellites.Text = "(Not Enough Satellites for GPS Positioning, Logging Stopped)";
					this.lblInsufficientSatellites.ForeColor = Color.White;
					this.lblInsufficientSatellites.BackColor = Color.Red;
					this.lblInsufficientSatellites.Visible = true;
				}
				else
				{
					MainForm.bGpsNotification = false;
					this.lblInsufficientSatellites.Text = "(Not Enough Satellites for GPS Positioning)";
					this.lblInsufficientSatellites.ForeColor = Color.Red;
					this.lblInsufficientSatellites.BackColor = Control.DefaultBackColor;
					this.lblInsufficientSatellites.Visible = true;
				}
			}
			else if (gpsNumberOfSatellites == 3 && this.txtbxCurGpsData.Text != "")
			{
				MainForm.bGpsNotification = false;
				MainForm.bGpsNotificationTriggered = false;
				this.lblInsufficientSatellites.Text = "(Not Enough Satellites for Accurate GPS Position)";
				this.lblInsufficientSatellites.ForeColor = Color.RoyalBlue;
				this.lblInsufficientSatellites.BackColor = Control.DefaultBackColor;
				this.lblInsufficientSatellites.Visible = true;
			}
			else
			{
				MainForm.bGpsNotification = false;
				MainForm.bGpsNotificationTriggered = false;
				this.lblInsufficientSatellites.Visible = false;
			}
			if (Program.HeightAlarm)
			{
				Program.HeightAlarm = false;
				if (!MainForm.bAlarmTriggered)
				{
					MainForm.bAlarmTriggered = true;
					Program.HeightNotification = false;
					MainForm.bGpsNotificationTriggered = true;
					this.txtbxMinHeightMeas.BackColor = Color.Red;
					this.StopAllSounds();
					this.objAlarmSound.Play();
					return;
				}
			}
			else
			{
				if (MainForm.bGpsNotification && !MainForm.bGpsNotificationTriggered)
				{
					MainForm.bGpsNotificationTriggered = true;
					Program.HeightNotification = false;
					this.StopAllSounds();
					this.objNotificationGps.Play();
					return;
				}
				if (Program.HeightNotification)
				{
					Program.HeightNotification = false;
					if (Program.AppPropertiesObject.AppConfig.enumNotificationSound == enNotificationSound.Beep)
					{
						this.StopAllSounds();
						this.objNotificationBeep.Play();
						return;
					}
					if (Program.AppPropertiesObject.AppConfig.enumNotificationSound == enNotificationSound.Ding)
					{
						this.StopAllSounds();
						this.objNotificationDing.Play();
						return;
					}
					if (Program.AppPropertiesObject.AppConfig.enumNotificationSound == enNotificationSound.Horn)
					{
						this.StopAllSounds();
						this.objNotificationHorn.Play();
					}
				}
			}
		}

		// Token: 0x06000075 RID: 117 RVA: 0x0000776D File Offset: 0x0000596D
		private void StopAllSounds()
		{
			this.objAlarmSound.Stop();
			this.objNotificationBeep.Stop();
			this.objNotificationDing.Stop();
			this.objNotificationHorn.Stop();
			this.objNotificationGps.Stop();
		}

		// Token: 0x06000076 RID: 118 RVA: 0x000077A8 File Offset: 0x000059A8
		private void MainForm_Activated(object sender, EventArgs e)
		{
			if (Program.GetMetricFlag())
			{
				this.txtbxMaxHeight.Text = Program.GetMaxHeight().ToString("F3") + " m (set)";
			}
			else
			{
				this.txtbxMaxHeight.Text = (Program.GetMaxHeight() / 0.0254).ToString("F2") + " in (set)";
			}
			int num;
			double num2;
			Program.ConvertMetersToFeetInch(Program.GetMaxHeight(), out num, out num2);
			this.txtbxMaxHeight2.Text = string.Concat(new string[]
			{
				" = ",
				num.ToString("D"),
				" ft, ",
				num2.ToString("F2"),
				" in"
			});
		}

		// Token: 0x04000056 RID: 86
		public MainForm.GetStringDelegate GetNotes;

		// Token: 0x04000057 RID: 87
		public MainForm.GetStringDelegate GetObstruction;

		// Token: 0x04000058 RID: 88
		public MainForm.GetStringDelegate GetTemperature;

		// Token: 0x04000059 RID: 89
		public MainForm.GetStringDelegate GetRouteSegment;

		// Token: 0x0400005A RID: 90
		public MainForm.UpdateStringDelegate AddLogEntryList;

		// Token: 0x0400005B RID: 91
		private static bool bAlarmTriggered = false;

		// Token: 0x0400005C RID: 92
		private static string sObstructionListFile = "ObstructionList.txt";

		// Token: 0x0400005D RID: 93
		private SoundPlayer objAlarmSound = new SoundPlayer(Resource1.ALARME2);

		// Token: 0x0400005E RID: 94
		private SoundPlayer objNotificationBeep = new SoundPlayer(Resource1.BEEPDOUB);

		// Token: 0x0400005F RID: 95
		private SoundPlayer objNotificationDing = new SoundPlayer(Resource1.Windows7GardenDing);

		// Token: 0x04000060 RID: 96
		private SoundPlayer objNotificationHorn = new SoundPlayer(Resource1.bizniss_horn);

		// Token: 0x04000061 RID: 97
		private SoundPlayer objNotificationGps = new SoundPlayer(Resource1.jobro_1_alarm);

		// Token: 0x04000062 RID: 98
		private static int iDefaultObstructionTypeStartIndex;

		// Token: 0x04000063 RID: 99
		private static int iCustomObstructionTypeNumItems;

		// Token: 0x04000064 RID: 100
		private const int iMAX_LOG_LINES = 20;

		// Token: 0x04000065 RID: 101
		private string sVerticalTab = '\v'.ToString();

		// Token: 0x04000066 RID: 102
		private string sFormFeed = '\f'.ToString();

		// Token: 0x04000067 RID: 103
		private string sNextLine = '\u0085'.ToString();

		// Token: 0x04000068 RID: 104
		private string sLineSeparator = '\u2028'.ToString();

		// Token: 0x04000069 RID: 105
		private string sParagraphSeparator = '\u2029'.ToString();

		// Token: 0x0400006A RID: 106
		private readonly string[] a1sObstructionKeymapArray = new string[]
		{
			"Alt+Space",
			"Alt+F1",
			"Alt+F2",
			"Alt+F3",
			"Alt+F4",
			"Alt+F5",
			"Alt+F6",
			"Alt+F7",
			"Alt+F8",
			"Alt+F9",
			"Alt+F10",
			"Alt+F11",
			"Alt+F12",
			"Alt+1",
			"Alt+2",
			"Alt+3",
			"Alt+4",
			"Alt+5",
			"Alt+6",
			"Alt+7",
			"Alt+8",
			"Alt+9",
			"Alt+0"
		};

		// Token: 0x0400006B RID: 107
		private List<string> lstObstructionList = new List<string>();

		// Token: 0x0400006C RID: 108
		private static bool bGpsNotification = false;

		// Token: 0x0400006D RID: 109
		private static bool bGpsNotificationTriggered = false;

		// Token: 0x0400006E RID: 110
		private static bool bLaserQueueEmptying = false;

		// Token: 0x0200001A RID: 26
		// (Invoke) Token: 0x060000D5 RID: 213
		public delegate void UpdateStringDelegate(string String);

		// Token: 0x0200001B RID: 27
		// (Invoke) Token: 0x060000D9 RID: 217
		public delegate string GetStringDelegate();
	}
}
