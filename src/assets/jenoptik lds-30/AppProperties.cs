using System;
using Newtonsoft.Json;

namespace RSA_Laser_Test_App
{
	// Token: 0x02000006 RID: 6
	public class AppProperties
	{
		// Token: 0x17000001 RID: 1
		// (get) Token: 0x06000018 RID: 24 RVA: 0x00004991 File Offset: 0x00002B91
		// (set) Token: 0x06000019 RID: 25 RVA: 0x00004999 File Offset: 0x00002B99
		[JsonProperty("ComConfig")]
		public ComConfigSettings ComConfig { get; set; }

		// Token: 0x17000002 RID: 2
		// (get) Token: 0x0600001A RID: 26 RVA: 0x000049A2 File Offset: 0x00002BA2
		// (set) Token: 0x0600001B RID: 27 RVA: 0x000049AA File Offset: 0x00002BAA
		[JsonProperty("LaserDataConfig")]
		public LaserDataConfigSettings LaserDataConfig { get; set; }

		// Token: 0x17000003 RID: 3
		// (get) Token: 0x0600001C RID: 28 RVA: 0x000049B3 File Offset: 0x00002BB3
		// (set) Token: 0x0600001D RID: 29 RVA: 0x000049BB File Offset: 0x00002BBB
		[JsonProperty("HeightConfig")]
		public HeightConfigSettings HeightConfig { get; set; }

		// Token: 0x17000004 RID: 4
		// (get) Token: 0x0600001E RID: 30 RVA: 0x000049C4 File Offset: 0x00002BC4
		// (set) Token: 0x0600001F RID: 31 RVA: 0x000049CC File Offset: 0x00002BCC
		[JsonProperty("GpsConfig")]
		public GpsConfigSettings GpsConfig { get; set; }

		// Token: 0x17000005 RID: 5
		// (get) Token: 0x06000020 RID: 32 RVA: 0x000049D5 File Offset: 0x00002BD5
		// (set) Token: 0x06000021 RID: 33 RVA: 0x000049DD File Offset: 0x00002BDD
		[JsonProperty("AppConfig")]
		public AppConfigSettings AppConfig { get; set; }

		// Token: 0x06000022 RID: 34 RVA: 0x000049E8 File Offset: 0x00002BE8
		public AppProperties()
		{
			this.ComConfig = new ComConfigSettings();
			this.LaserDataConfig = new LaserDataConfigSettings();
			this.HeightConfig = new HeightConfigSettings();
			this.GpsConfig = new GpsConfigSettings();
			this.AppConfig = new AppConfigSettings();
			this.a1enumLoggingDataColumnConfig[0] = enDataColumn.Longitude;
			this.a1enumLoggingDataColumnConfig[1] = enDataColumn.Latitude;
			this.a1enumLoggingDataColumnConfig[2] = enDataColumn.Height;
			this.a1enumLoggingDataColumnConfig[3] = enDataColumn.Item;
			this.a1enumLoggingDataColumnConfig[4] = enDataColumn.Description;
			this.a1enumLoggingDataColumnConfig[5] = enDataColumn.Date;
			this.a1enumLoggingDataColumnConfig[6] = enDataColumn.Time;
			this.a1enumLoggingDataColumnConfig[7] = enDataColumn.Num_Gps_Sats;
			this.a1enumLoggingDataColumnConfig[8] = enDataColumn.Laser_Intensity;
			this.a1enumLoggingDataColumnConfig[9] = enDataColumn.Blank;
			this.a1enumLoggingDataColumnConfig[10] = enDataColumn.Blank;
		}

		// Token: 0x0400003A RID: 58
		public enDataColumn[] a1enumLoggingDataColumnConfig = new enDataColumn[11];
	}
}
