import type { ResumeData, PersonalInfo, Experience, Language, Skill, Project, Certificate, Award, Publication, Hobby, Volunteer } from '../types/resume';
import { PhotoUpload } from './PhotoUpload';

interface Props {
    data: ResumeData;
    onChange: (data: ResumeData) => void;
}

function PersonalInfoForm({ data, onChange }: { data: PersonalInfo; onChange: (d: PersonalInfo) => void }) {
    const update = <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) => {
        onChange({ ...data, [key]: value });
    };

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-600">基本信息</h4>
            <input
                placeholder="姓名"
                value={data.name || ''}
                onChange={(e) => update('name', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded"
            />
            <input
                placeholder="职位/头衔"
                value={data.title || ''}
                onChange={(e) => update('title', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded"
            />
            <div className="grid grid-cols-2 gap-2">
                <input
                    placeholder="邮箱"
                    value={data.email || ''}
                    onChange={(e) => update('email', e.target.value)}
                    className="px-2 py-1.5 text-sm border rounded"
                />
                <input
                    placeholder="电话"
                    value={data.phone || ''}
                    onChange={(e) => update('phone', e.target.value)}
                    className="px-2 py-1.5 text-sm border rounded"
                />
            </div>
            <input
                placeholder="地址"
                value={data.address || ''}
                onChange={(e) => update('address', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded"
            />
            <div className="grid grid-cols-2 gap-2">
                <input
                    placeholder="网站"
                    value={data.website || ''}
                    onChange={(e) => update('website', e.target.value)}
                    className="px-2 py-1.5 text-sm border rounded"
                />
                <input
                    placeholder="国籍"
                    value={data.nationality || ''}
                    onChange={(e) => update('nationality', e.target.value)}
                    className="px-2 py-1.5 text-sm border rounded"
                />
            </div>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">头像照片</label>
                <PhotoUpload
                    value={data.photo || ''}
                    onChange={(v) => update('photo', v)}
                />
            </div>
            <textarea
                placeholder="个人简介"
                value={data.summary || ''}
                onChange={(e) => update('summary', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded"
                rows={3}
            />
        </div>
    );
}

function ExperienceForm({
    title,
    items,
    onChange
}: {
    title: string;
    items: Experience[];
    onChange: (items: Experience[]) => void
}) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            company: '',
            position: '',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            description: '',
            highlights: []
        }]);
    };

    const updateItem = (index: number, updates: Partial<Experience>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">{title}</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="flex gap-2">
                        <input
                            placeholder="公司/学校"
                            value={item.company}
                            onChange={(e) => updateItem(i, { company: e.target.value })}
                            className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                        />
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="职位/学位"
                            value={item.position}
                            onChange={(e) => updateItem(i, { position: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="时间"
                            value={`${item.startDate}${item.endDate ? ' - ' + item.endDate : ''}`}
                            onChange={(e) => {
                                const parts = e.target.value.split(' - ');
                                updateItem(i, { startDate: parts[0] || '', endDate: parts[1] || '' });
                            }}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <textarea
                        placeholder="描述"
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                        rows={2}
                    />
                </div>
            ))}
        </div>
    );
}

function LanguagesForm({ items, onChange }: { items: Language[]; onChange: (items: Language[]) => void }) {
    const addItem = () => {
        onChange([...items, { id: Date.now().toString(), name: '', level: 'intermediate', levelNumber: 3, flag: '🏳️' }]);
    };

    const updateItem = (index: number, updates: Partial<Language>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">语言能力</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="flex items-center gap-2">
                    <input
                        placeholder="🇨🇳"
                        value={item.flag}
                        onChange={(e) => updateItem(i, { flag: e.target.value })}
                        className="w-10 px-1 py-0.5 text-center text-sm border rounded"
                    />
                    <input
                        placeholder="语言"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                    />
                    <select
                        value={item.levelNumber}
                        onChange={(e) => updateItem(i, { levelNumber: parseInt(e.target.value) })}
                        className="px-1 py-0.5 text-xs border rounded"
                    >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                </div>
            ))}
        </div>
    );
}

function SkillsForm({ title, items, onChange }: { title: string; items: Skill[]; onChange: (items: Skill[]) => void }) {
    const addItem = () => {
        onChange([...items, { id: Date.now().toString(), name: '', level: 3, category: 'technical', icon: '📌', years: 0, subSkills: [] }]);
    };

    const updateItem = (index: number, updates: Partial<Skill>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">{title}</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="flex items-center gap-2">
                    <input
                        placeholder="📌"
                        value={item.icon}
                        onChange={(e) => updateItem(i, { icon: e.target.value })}
                        className="w-10 px-1 py-0.5 text-center text-sm border rounded"
                    />
                    <input
                        placeholder="技能名称"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                    />
                    <select
                        value={item.level}
                        onChange={(e) => updateItem(i, { level: parseInt(e.target.value) })}
                        className="px-1 py-0.5 text-xs border rounded"
                    >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                </div>
            ))}
        </div>
    );
}

// ─── 项目经历表单 ─────────────────────────────────────────────────────────────
function ProjectsForm({ items, onChange }: { items: Project[]; onChange: (items: Project[]) => void }) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            name: '',
            role: '',
            organization: '',
            startDate: '',
            endDate: '',
            description: '',
            highlights: [],
            technologies: [],
            url: ''
        }]);
    };

    const updateItem = (index: number, updates: Partial<Project>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">项目经历</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="flex gap-2">
                        <input
                            placeholder="项目名称"
                            value={item.name}
                            onChange={(e) => updateItem(i, { name: e.target.value })}
                            className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                        />
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="角色"
                            value={item.role}
                            onChange={(e) => updateItem(i, { role: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="组织/公司"
                            value={item.organization}
                            onChange={(e) => updateItem(i, { organization: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="开始时间"
                            value={item.startDate}
                            onChange={(e) => updateItem(i, { startDate: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="结束时间"
                            value={item.endDate}
                            onChange={(e) => updateItem(i, { endDate: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <input
                        placeholder="技术栈（用逗号分隔）"
                        value={item.technologies?.join(', ') || ''}
                        onChange={(e) => updateItem(i, { technologies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                    />
                    <textarea
                        placeholder="项目描述"
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                        rows={2}
                    />
                </div>
            ))}
        </div>
    );
}

// ─── 证书表单 ─────────────────────────────────────────────────────────────────
function CertificatesForm({ items, onChange }: { items: Certificate[]; onChange: (items: Certificate[]) => void }) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            name: '',
            issuer: '',
            date: '',
            expiryDate: '',
            credentialId: '',
            url: ''
        }]);
    };

    const updateItem = (index: number, updates: Partial<Certificate>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">证书资质</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="flex gap-2">
                        <input
                            placeholder="证书名称"
                            value={item.name}
                            onChange={(e) => updateItem(i, { name: e.target.value })}
                            className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                        />
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="颁发机构"
                            value={item.issuer}
                            onChange={(e) => updateItem(i, { issuer: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="获得日期"
                            value={item.date}
                            onChange={(e) => updateItem(i, { date: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <input
                        placeholder="证书编号（可选）"
                        value={item.credentialId}
                        onChange={(e) => updateItem(i, { credentialId: e.target.value })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                    />
                </div>
            ))}
        </div>
    );
}

// ─── 奖项表单 ─────────────────────────────────────────────────────────────────
function AwardsForm({ items, onChange }: { items: Award[]; onChange: (items: Award[]) => void }) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            title: '',
            issuer: '',
            date: '',
            description: ''
        }]);
    };

    const updateItem = (index: number, updates: Partial<Award>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">获奖荣誉</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="flex gap-2">
                        <input
                            placeholder="奖项名称"
                            value={item.title}
                            onChange={(e) => updateItem(i, { title: e.target.value })}
                            className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                        />
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="颁发机构"
                            value={item.issuer}
                            onChange={(e) => updateItem(i, { issuer: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="获奖日期"
                            value={item.date}
                            onChange={(e) => updateItem(i, { date: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <textarea
                        placeholder="奖项描述（可选）"
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                        rows={1}
                    />
                </div>
            ))}
        </div>
    );
}

// ─── 出版物表单 ───────────────────────────────────────────────────────────────
function PublicationsForm({ items, onChange }: { items: Publication[]; onChange: (items: Publication[]) => void }) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            title: '',
            authors: '',
            publisher: '',
            date: '',
            url: '',
            description: ''
        }]);
    };

    const updateItem = (index: number, updates: Partial<Publication>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">出版物</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="flex gap-2">
                        <input
                            placeholder="标题"
                            value={item.title}
                            onChange={(e) => updateItem(i, { title: e.target.value })}
                            className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                        />
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </div>
                    <input
                        placeholder="作者"
                        value={item.authors}
                        onChange={(e) => updateItem(i, { authors: e.target.value })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                    />
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="出版商/期刊"
                            value={item.publisher}
                            onChange={(e) => updateItem(i, { publisher: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="发布日期"
                            value={item.date}
                            onChange={(e) => updateItem(i, { date: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── 兴趣爱好表单 ─────────────────────────────────────────────────────────────
function HobbiesForm({ items, onChange }: { items: Hobby[]; onChange: (items: Hobby[]) => void }) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            name: '',
            icon: '🎯',
            description: ''
        }]);
    };

    const updateItem = (index: number, updates: Partial<Hobby>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">兴趣爱好</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="flex items-center gap-2">
                    <input
                        placeholder="🎯"
                        value={item.icon}
                        onChange={(e) => updateItem(i, { icon: e.target.value })}
                        className="w-10 px-1 py-0.5 text-center text-sm border rounded"
                    />
                    <input
                        placeholder="爱好名称"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                    />
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                </div>
            ))}
        </div>
    );
}

// ─── 志愿者经历表单 ───────────────────────────────────────────────────────────
function VolunteerForm({ items, onChange }: { items: Volunteer[]; onChange: (items: Volunteer[]) => void }) {
    const addItem = () => {
        onChange([...items, {
            id: Date.now().toString(),
            organization: '',
            role: '',
            location: '',
            startDate: '',
            endDate: '',
            description: '',
            highlights: []
        }]);
    };

    const updateItem = (index: number, updates: Partial<Volunteer>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const removeItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-gray-600">志愿者经历</h4>
                <button onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700">+ 添加</button>
            </div>
            {(items || []).map((item, i) => (
                <div key={item.id} className="p-2 bg-gray-50 rounded text-sm space-y-1">
                    <div className="flex gap-2">
                        <input
                            placeholder="组织名称"
                            value={item.organization}
                            onChange={(e) => updateItem(i, { organization: e.target.value })}
                            className="flex-1 px-1.5 py-0.5 text-xs border rounded"
                        />
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="角色"
                            value={item.role}
                            onChange={(e) => updateItem(i, { role: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="地点"
                            value={item.location}
                            onChange={(e) => updateItem(i, { location: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <input
                            placeholder="开始时间"
                            value={item.startDate}
                            onChange={(e) => updateItem(i, { startDate: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                        <input
                            placeholder="结束时间"
                            value={item.endDate}
                            onChange={(e) => updateItem(i, { endDate: e.target.value })}
                            className="px-1.5 py-0.5 text-xs border rounded"
                        />
                    </div>
                    <textarea
                        placeholder="描述"
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className="w-full px-1.5 py-0.5 text-xs border rounded"
                        rows={2}
                    />
                </div>
            ))}
        </div>
    );
}

export function ContentForm({ data, onChange }: Props) {
    const update = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
        onChange({ ...data, [key]: value });
    };

    return (
        <div className="space-y-5">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">内容编辑</h3>

            <PersonalInfoForm
                data={data.personal}
                onChange={(personal) => update('personal', personal)}
            />

            <LanguagesForm
                items={data.languages || []}
                onChange={(languages) => update('languages', languages)}
            />

            <SkillsForm
                title="技能"
                items={data.skills || []}
                onChange={(skills) => update('skills', skills)}
            />

            <ExperienceForm
                title="工作经历"
                items={data.experience || []}
                onChange={(experience) => update('experience', experience)}
            />

            <ExperienceForm
                title="教育背景"
                items={data.education?.map(e => ({
                    id: e.id,
                    company: e.institution,
                    position: `${e.degree} ${e.field}`,
                    location: e.location,
                    startDate: e.startDate,
                    endDate: e.endDate,
                    current: false,
                    description: e.description,
                    highlights: []
                })) || []}
                onChange={(items) => update('education', items.map(e => ({
                    id: e.id,
                    institution: e.company,
                    degree: e.position.split(' ')[0] || '',
                    field: e.position.split(' ').slice(1).join(' ') || '',
                    location: e.location,
                    startDate: e.startDate,
                    endDate: e.endDate,
                    gpa: '',
                    description: e.description,
                    courses: []
                })))}
            />

            {/* 附加模块 - 只在有数据时显示，或允许用户添加 */}
            <ProjectsForm
                items={data.projects || []}
                onChange={(projects) => update('projects', projects)}
            />

            <CertificatesForm
                items={data.certificates || []}
                onChange={(certificates) => update('certificates', certificates)}
            />

            <AwardsForm
                items={data.awards || []}
                onChange={(awards) => update('awards', awards)}
            />

            <PublicationsForm
                items={data.publications || []}
                onChange={(publications) => update('publications', publications)}
            />

            <HobbiesForm
                items={data.hobbies || []}
                onChange={(hobbies) => update('hobbies', hobbies)}
            />

            <VolunteerForm
                items={data.volunteer || []}
                onChange={(volunteer) => update('volunteer', volunteer)}
            />
        </div>
    );
}
