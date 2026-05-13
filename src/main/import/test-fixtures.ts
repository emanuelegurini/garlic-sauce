type ZipFixtureEntry = {
  path: string;
  data: Buffer;
};

function zipEntry(path: string, data: string | Buffer): ZipFixtureEntry {
  return {
    path,
    data: Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'),
  };
}

function createStoredZip(entries: ZipFixtureEntry[]): Buffer {
  const localFiles: Buffer[] = [];
  const centralFiles: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const localHeader = Buffer.alloc(30 + name.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    name.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + name.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    name.copy(centralHeader, 46);

    localFiles.push(localHeader, entry.data);
    centralFiles.push(centralHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralFiles);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localFiles, centralDirectory, endOfCentralDirectory]);
}

export function createSamplePptx(): Buffer {
  return createStoredZip([
    zipEntry(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="xml" ContentType="application/xml"/>
        <Default Extension="png" ContentType="image/png"/>
        <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
        <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
      </Types>`,
    ),
    zipEntry(
      'docProps/core.xml',
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
        xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Quarterly Training</dc:title>
      </cp:coreProperties>`,
    ),
    zipEntry(
      'ppt/presentation.xml',
      `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
        <p:sldIdLst>
          <p:sldId id="256" r:id="rId1"/>
        </p:sldIdLst>
      </p:presentation>`,
    ),
    zipEntry(
      'ppt/_rels/presentation.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
      </Relationships>`,
    ),
    zipEntry(
      'ppt/theme/theme1.xml',
      `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
        <a:themeElements>
          <a:clrScheme name="Office">
            <a:dk1><a:srgbClr val="000000"/></a:dk1>
            <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
            <a:accent1><a:srgbClr val="1D5F5B"/></a:accent1>
          </a:clrScheme>
          <a:fontScheme name="Office">
            <a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont>
            <a:minorFont><a:latin typeface="Aptos"/></a:minorFont>
          </a:fontScheme>
        </a:themeElements>
      </a:theme>`,
    ),
    zipEntry(
      'ppt/slides/slide1.xml',
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:bg><p:bgPr><a:solidFill><a:srgbClr val="F7F8FA"/></a:solidFill></p:bgPr></p:bg>
          <p:spTree>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr txBox="1"/></p:nvSpPr>
              <p:spPr>
                <a:xfrm><a:off x="914400" y="685800"/><a:ext cx="5486400" cy="914400"/></a:xfrm>
                <a:prstGeom prst="rect"/>
                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                <a:ln w="12700"><a:solidFill><a:srgbClr val="202124"/></a:solidFill></a:ln>
              </p:spPr>
              <p:txBody>
                <a:bodyPr/>
                <a:p>
                  <a:pPr algn="ctr"/>
                  <a:r>
                    <a:rPr b="1" i="0" sz="2400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>
                    <a:t>Hello &amp; welcome</a:t>
                  </a:r>
                </a:p>
              </p:txBody>
            </p:sp>
            <p:pic>
              <p:nvPicPr><p:cNvPr id="3" name="Logo"/></p:nvPicPr>
              <p:blipFill><a:blip r:embed="rIdImage1"/></p:blipFill>
              <p:spPr><a:xfrm><a:off x="7315200" y="685800"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr>
            </p:pic>
          </p:spTree>
        </p:cSld>
      </p:sld>`,
    ),
    zipEntry(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
        <Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
      </Relationships>`,
    ),
    zipEntry(
      'ppt/slideLayouts/slideLayout1.xml',
      `<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld name="Title Slide"/>
      </p:sldLayout>`,
    ),
    zipEntry('ppt/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  ]);
}

function pptRecord(recordType: number, payload: Buffer, recordVersion = 0): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(recordVersion, 0);
  header.writeUInt16LE(recordType, 2);
  header.writeUInt32LE(payload.length, 4);

  return Buffer.concat([header, payload]);
}

export function createLegacyPptBuffer(): Buffer {
  const documentAtom = Buffer.alloc(8);
  documentAtom.writeInt32LE(720, 0);
  documentAtom.writeInt32LE(540, 4);

  return Buffer.concat([
    pptRecord(1001, documentAtom),
    pptRecord(1006, Buffer.alloc(0)),
    pptRecord(4000, Buffer.from('Legacy slide text', 'utf16le')),
  ]);
}
