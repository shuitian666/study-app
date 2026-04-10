# -*- coding: utf-8 -*-
"""
生成微生物与免疫学知识点（20个）及配套题目
"""

import sys
import io
import json
from pathlib import Path
from datetime import datetime

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))


def main():
    print("=" * 60)
    print("生成微生物与免疫学知识点")
    print("=" * 60)

    now = datetime.now().isoformat()

    # 定义学科
    subject = {
        "id": "micro",
        "name": "微生物与免疫学",
        "icon": "🦠",
        "color": "#059669",
        "knowledgePointCount": 20
    }

    # 定义章节
    chapters = [
        {"id": "micro-ch1", "subjectId": "micro", "name": "微生物学基础", "order": 1},
        {"id": "micro-ch2", "subjectId": "micro", "name": "细菌学", "order": 2},
        {"id": "micro-ch3", "subjectId": "micro", "name": "病毒学", "order": 3},
        {"id": "micro-ch4", "subjectId": "micro", "name": "免疫学基础", "order": 4},
    ]

    # 知识点和题目数据
    knowledge_data = [
        # 第1章 微生物学基础
        {
            "chapterId": "micro-ch1",
            "name": "微生物的概念与分类",
            "explanation": "微生物是存在于自然界的一大群体形微小、结构简单、肉眼直接看不见，必须借助光学显微镜或电子显微镜放大数百倍、数千倍甚至数万倍才能观察到的微小生物。分类：①非细胞型微生物（病毒）；②原核细胞型微生物（细菌、支原体、衣原体、立克次体、螺旋体、放线菌）；③真核细胞型微生物（真菌）。",
            "questions": [
                {
                    "stem": "下列不属于原核细胞型微生物的是？",
                    "options": [
                        {"id": "a", "text": "细菌"},
                        {"id": "b", "text": "病毒"},
                        {"id": "c", "text": "支原体"},
                        {"id": "d", "text": "衣原体"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "病毒属于非细胞型微生物，无细胞结构，仅由核酸和蛋白质外壳组成，必须在活细胞内寄生。"
                }
            ]
        },
        {
            "chapterId": "micro-ch1",
            "name": "革兰氏染色法原理",
            "explanation": "革兰氏染色法是细菌学中最常用的鉴别染色法。步骤：①结晶紫初染；②碘液媒染；③95%乙醇脱色；④沙黄复染。原理：革兰氏阳性菌细胞壁肽聚糖层厚、交联度高，乙醇脱色时肽聚糖层孔径缩小，结晶紫-碘复合物保留在细胞内呈紫色；革兰氏阴性菌细胞壁肽聚糖层薄、交联度低，且含大量脂质，乙醇脱色时脂质溶解，结晶紫-碘复合物被洗出，复染后呈红色。",
            "questions": [
                {
                    "stem": "革兰氏阳性菌呈紫色的原因是？",
                    "options": [
                        {"id": "a", "text": "细胞壁含大量脂质"},
                        {"id": "b", "text": "肽聚糖层厚且交联度高"},
                        {"id": "c", "text": "无细胞壁"},
                        {"id": "d", "text": "细胞膜含特殊蛋白质"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "革兰氏阳性菌细胞壁肽聚糖层厚、交联度高，乙醇脱色时肽聚糖层孔径缩小，结晶紫-碘复合物保留在细胞内呈紫色。"
                }
            ]
        },
        # 第2章 细菌学
        {
            "chapterId": "micro-ch2",
            "name": "细菌的基本结构",
            "explanation": "细菌的基本结构包括：①细胞壁：维持细菌形态，保护细菌；②细胞膜：物质转运、呼吸和合成功能；③细胞质：含核糖体、质粒等；④核质：细菌的遗传物质。特殊结构包括：荚膜（抗吞噬）、鞭毛（运动）、菌毛（黏附）、芽胞（抵抗力强，灭菌指标）。",
            "questions": [
                {
                    "stem": "下列哪项不是细菌的基本结构？",
                    "options": [
                        {"id": "a", "text": "细胞壁"},
                        {"id": "b", "text": "细胞膜"},
                        {"id": "c", "text": "荚膜"},
                        {"id": "d", "text": "细胞质"}
                    ],
                    "correctAnswers": ["c"],
                    "explanation": "荚膜是细菌的特殊结构，不是基本结构。基本结构包括细胞壁、细胞膜、细胞质、核质。"
                }
            ]
        },
        {
            "chapterId": "micro-ch2",
            "name": "细菌的生长繁殖",
            "explanation": "细菌以二分裂方式进行无性繁殖。生长曲线分为四期：①迟缓期：适应环境，代谢活跃，不分裂；②对数期：生长迅速，形态典型，对外界敏感，用于鉴定；③稳定期：繁殖与死亡平衡，产生代谢产物（抗生素、毒素）；④衰亡期：死亡数超过繁殖数，形态退变。",
            "questions": [
                {
                    "stem": "细菌形态典型、对外界环境敏感的时期是？",
                    "options": [
                        {"id": "a", "text": "迟缓期"},
                        {"id": "b", "text": "对数期"},
                        {"id": "c", "text": "稳定期"},
                        {"id": "d", "text": "衰亡期"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "对数期细菌生长迅速，形态典型，对外界环境敏感，常用于细菌鉴定和药物敏感性试验。"
                }
            ]
        },
        {
            "chapterId": "micro-ch2",
            "name": "细菌的代谢产物",
            "explanation": "细菌的合成代谢产物包括：①热原质：引起发热反应；②毒素与侵袭性酶：致病物质；③色素：有助于鉴别；④抗生素：抑制或杀灭其他微生物；⑤维生素：供自身及宿主利用；⑥细菌素：仅对近缘菌有作用。分解代谢产物可用于细菌鉴定（糖发酵试验等）。",
            "questions": [
                {
                    "stem": "下列哪项不是细菌的合成代谢产物？",
                    "options": [
                        {"id": "a", "text": "热原质"},
                        {"id": "b", "text": "毒素"},
                        {"id": "c", "text": "抗生素"},
                        {"id": "d", "text": "二氧化碳"}
                    ],
                    "correctAnswers": ["d"],
                    "explanation": "二氧化碳是细菌的分解代谢产物，不是合成代谢产物。合成代谢产物包括热原质、毒素、抗生素、维生素等。"
                }
            ]
        },
        {
            "chapterId": "micro-ch2",
            "name": "消毒与灭菌",
            "explanation": "消毒：杀灭物体上病原微生物，不一定杀芽胞；灭菌：杀灭所有微生物（包括芽胞）；防腐：抑制微生物生长繁殖；无菌：无活微生物。常用方法：①物理法：热力（高压蒸汽灭菌法最常用，121℃15-20分钟）、紫外线、电离辐射；②化学法：消毒剂（75%乙醇、碘伏等）。",
            "questions": [
                {
                    "stem": "杀灭芽胞最可靠的方法是？",
                    "options": [
                        {"id": "a", "text": "煮沸法"},
                        {"id": "b", "text": "高压蒸汽灭菌法"},
                        {"id": "c", "text": "紫外线照射"},
                        {"id": "d", "text": "75%乙醇浸泡"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "高压蒸汽灭菌法（121℃，15-20分钟）可杀灭包括芽胞在内的所有微生物，是最可靠的灭菌方法。"
                }
            ]
        },
        {
            "chapterId": "micro-ch2",
            "name": "正常菌群与条件致病菌",
            "explanation": "正常菌群：寄居在正常人皮肤、黏膜，对人体无害的微生物。生理作用：①生物拮抗；②营养作用；③免疫作用；④抗衰老作用。条件致病菌：正常菌群在特定条件下可致病，条件包括：①寄居部位改变；②宿主免疫功能低下；③菌群失调。",
            "questions": [
                {
                    "stem": "正常菌群的生理作用不包括？",
                    "options": [
                        {"id": "a", "text": "生物拮抗"},
                        {"id": "b", "text": "营养作用"},
                        {"id": "c", "text": "免疫作用"},
                        {"id": "d", "text": "致病作用"}
                    ],
                    "correctAnswers": ["d"],
                    "explanation": "正常菌群的生理作用包括生物拮抗、营养作用、免疫作用、抗衰老作用等，致病作用不是正常菌群的生理作用。"
                }
            ]
        },
        {
            "chapterId": "micro-ch2",
            "name": "细菌的致病性",
            "explanation": "细菌致病性取决于毒力、侵入数量和侵入途径。毒力包括侵袭力和毒素。侵袭力：黏附素、荚膜、侵袭性酶等。毒素：①外毒素：革兰氏阳性菌产生，蛋白质，毒性强，选择性作用，免疫原性强，可脱毒制成类毒素；②内毒素：革兰氏阴性菌细胞壁脂多糖，毒性较弱，引起发热、休克等，免疫原性弱，不能制成类毒素。",
            "questions": [
                {
                    "stem": "关于外毒素的描述正确的是？",
                    "options": [
                        {"id": "a", "text": "革兰氏阴性菌产生"},
                        {"id": "b", "text": "脂多糖成分"},
                        {"id": "c", "text": "可脱毒制成类毒素"},
                        {"id": "d", "text": "毒性较弱"}
                    ],
                    "correctAnswers": ["c"],
                    "explanation": "外毒素由革兰氏阳性菌产生，是蛋白质，毒性强，免疫原性强，可脱毒制成类毒素用于预防接种。"
                }
            ]
        },
        # 第3章 病毒学
        {
            "chapterId": "micro-ch3",
            "name": "病毒的基本特征",
            "explanation": "病毒是体积最微小、结构最简单的非细胞型微生物。特点：①体积微小，需电镜观察；②结构简单，仅含一种核酸（DNA或RNA）；③严格活细胞内寄生；④以复制方式增殖；⑤对抗生素不敏感，对干扰素敏感。",
            "questions": [
                {
                    "stem": "病毒的特征不包括？",
                    "options": [
                        {"id": "a", "text": "体积微小"},
                        {"id": "b", "text": "仅含一种核酸"},
                        {"id": "c", "text": "二分裂繁殖"},
                        {"id": "d", "text": "对抗生素不敏感"}
                    ],
                    "correctAnswers": ["c"],
                    "explanation": "病毒以复制方式增殖，不是二分裂繁殖。二分裂是细菌的繁殖方式。"
                }
            ]
        },
        {
            "chapterId": "micro-ch3",
            "name": "病毒的结构",
            "explanation": "病毒的基本结构：①核心：含DNA或RNA；②衣壳：蛋白质，保护核酸，介导吸附。部分病毒有包膜：脂质双层，来自宿主细胞膜，包膜上有刺突（病毒抗原，可用于鉴定）。衣壳的对称类型：①螺旋对称；②20面体立体对称；③复合对称。",
            "questions": [
                {
                    "stem": "病毒包膜的来源是？",
                    "options": [
                        {"id": "a", "text": "病毒自身合成"},
                        {"id": "b", "text": "宿主细胞膜或核膜"},
                        {"id": "c", "text": "培养基成分"},
                        {"id": "d", "text": "衣壳蛋白变性"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "病毒包膜来自宿主细胞膜或核膜，是病毒在出芽释放时获得的，含有病毒编码的刺突蛋白。"
                }
            ]
        },
        {
            "chapterId": "micro-ch3",
            "name": "病毒的复制周期",
            "explanation": "病毒复制周期包括：①吸附：病毒与宿主细胞表面受体结合；②穿入：通过融合、胞饮或直接穿入；③脱壳：释放核酸；④生物合成：合成病毒核酸和蛋白质；⑤装配与释放：组装成子代病毒，通过出芽或细胞裂解释放。",
            "questions": [
                {
                    "stem": "病毒复制周期的正确顺序是？",
                    "options": [
                        {"id": "a", "text": "吸附→穿入→脱壳→生物合成→装配释放"},
                        {"id": "b", "text": "穿入→吸附→脱壳→生物合成→装配释放"},
                        {"id": "c", "text": "吸附→脱壳→穿入→生物合成→装配释放"},
                        {"id": "d", "text": "生物合成→吸附→穿入→脱壳→装配释放"}
                    ],
                    "correctAnswers": ["a"],
                    "explanation": "病毒复制周期的正确顺序是：吸附→穿入→脱壳→生物合成→装配释放。"
                }
            ]
        },
        {
            "chapterId": "micro-ch3",
            "name": "病毒的感染类型",
            "explanation": "病毒感染类型：①隐性感染：无症状，可获得免疫力；②显性感染：有症状，分为急性感染和持续性感染；③持续性感染又分为：慢性感染（病程长，病毒持续存在）、潜伏感染（病毒潜伏，间歇发作）、慢发病毒感染（潜伏期长，发病后进行性加重）。",
            "questions": [
                {
                    "stem": "单纯疱疹病毒的感染类型属于？",
                    "options": [
                        {"id": "a", "text": "急性感染"},
                        {"id": "b", "text": "慢性感染"},
                        {"id": "c", "text": "潜伏感染"},
                        {"id": "d", "text": "慢发病毒感染"}
                    ],
                    "correctAnswers": ["c"],
                    "explanation": "单纯疱疹病毒属于潜伏感染，病毒潜伏在神经节中，当机体免疫力下降时可复发引起口唇疱疹等。"
                }
            ]
        },
        {
            "chapterId": "micro-ch3",
            "name": "干扰素",
            "explanation": "干扰素是病毒或干扰素诱生剂诱导细胞产生的糖蛋白。特点：①广谱抗病毒；②有种属特异性；③间接抗病毒（诱导细胞产生抗病毒蛋白）；④还有免疫调节和抗肿瘤作用。抗病毒机制：诱导细胞合成抗病毒蛋白，降解病毒mRNA，抑制病毒蛋白合成。",
            "questions": [
                {
                    "stem": "干扰素的抗病毒机制是？",
                    "options": [
                        {"id": "a", "text": "直接灭活病毒"},
                        {"id": "b", "text": "诱导细胞产生抗病毒蛋白"},
                        {"id": "c", "text": "阻止病毒吸附"},
                        {"id": "d", "text": "破坏病毒包膜"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "干扰素不能直接灭活病毒，而是诱导细胞产生抗病毒蛋白，降解病毒mRNA，抑制病毒蛋白合成。"
                }
            ]
        },
        # 第4章 免疫学基础
        {
            "chapterId": "micro-ch4",
            "name": "免疫系统的组成",
            "explanation": "免疫系统由免疫器官、免疫细胞和免疫分子组成。免疫器官：①中枢免疫器官（骨髓、胸腺）：免疫细胞发生、分化、成熟的场所；②外周免疫器官（淋巴结、脾脏、黏膜相关淋巴组织）：免疫细胞定居、免疫应答发生的场所。免疫细胞：T细胞、B细胞、NK细胞、巨噬细胞、树突状细胞等。免疫分子：抗体、补体、细胞因子等。",
            "questions": [
                {
                    "stem": "下列属于中枢免疫器官的是？",
                    "options": [
                        {"id": "a", "text": "淋巴结"},
                        {"id": "b", "text": "脾脏"},
                        {"id": "c", "text": "骨髓"},
                        {"id": "d", "text": "扁桃体"}
                    ],
                    "correctAnswers": ["c"],
                    "explanation": "中枢免疫器官包括骨髓和胸腺，是免疫细胞发生、分化、成熟的场所。"
                }
            ]
        },
        {
            "chapterId": "micro-ch4",
            "name": "抗原的基本概念",
            "explanation": "抗原（Ag）是能刺激机体免疫系统产生免疫应答，并能与免疫应答产物（抗体或致敏淋巴细胞）特异性结合的物质。抗原的两个基本特性：①免疫原性：能刺激机体产生免疫应答；②抗原性（免疫反应性）：能与免疫应答产物特异性结合。同时具有这两种特性的物质称为完全抗原；只有抗原性而无免疫原性的物质称为半抗原。",
            "questions": [
                {
                    "stem": "抗原的两个基本特性是？",
                    "options": [
                        {"id": "a", "text": "免疫原性和抗原性"},
                        {"id": "b", "text": "异物性和特异性"},
                        {"id": "c", "text": "分子量大和结构复杂"},
                        {"id": "d", "text": "可降解性和构象"}
                    ],
                    "correctAnswers": ["a"],
                    "explanation": "抗原的两个基本特性是免疫原性（能刺激免疫应答）和抗原性（能与应答产物结合）。"
                }
            ]
        },
        {
            "chapterId": "micro-ch4",
            "name": "抗原表位",
            "explanation": "抗原表位（抗原决定簇）是抗原分子中与抗体或淋巴细胞抗原受体特异性结合的特殊化学基团，是抗原特异性的物质基础。分类：①顺序表位（线性表位）：由连续的氨基酸组成，主要被T细胞识别；②构象表位：由空间构象形成的不连续氨基酸组成，主要被B细胞识别。",
            "questions": [
                {
                    "stem": "决定抗原特异性的核心结构是？",
                    "options": [
                        {"id": "a", "text": "抗原分子量"},
                        {"id": "b", "text": "抗原表位"},
                        {"id": "c", "text": "抗原的物理性状"},
                        {"id": "d", "text": "抗原分子结构复杂度"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "抗原表位是抗原分子中与抗体或淋巴细胞抗原受体特异性结合的特殊化学基团，直接决定抗原特异性。"
                }
            ]
        },
        {
            "chapterId": "micro-ch4",
            "name": "抗体的基本结构",
            "explanation": "抗体（Ig）是由两条相同的重链（H链）和两条相同的轻链（L链）通过二硫键连接而成的Y形分子。可变区（V区）：位于N端，是抗原结合部位，包括高变区（互补决定区CDR）和骨架区。恒定区（C区）：位于C端，具有同种型抗原特异性。木瓜蛋白酶水解产生两个Fab段（抗原结合片段）和一个Fc段（可结晶片段）；胃蛋白酶水解产生一个F(ab')2段和pFc'段。",
            "questions": [
                {
                    "stem": "抗体的抗原结合部位位于？",
                    "options": [
                        {"id": "a", "text": "Fc段"},
                        {"id": "b", "text": "Fab段的可变区"},
                        {"id": "c", "text": "恒定区"},
                        {"id": "d", "text": "轻链的恒定区"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "抗体的抗原结合部位位于Fab段的可变区，特别是其中的高变区（互补决定区CDR）。"
                }
            ]
        },
        {
            "chapterId": "micro-ch4",
            "name": "五类免疫球蛋白的特性",
            "explanation": "免疫球蛋白分为五类：①IgG：血清中含量最高，唯一能通过胎盘的抗体，抗感染的主要抗体；②IgM：五聚体，分子量最大，产生最早，是初次应答的主要抗体，用于早期感染诊断；③IgA：分泌型IgA（sIgA）存在于外分泌液中，是黏膜局部免疫的主要抗体；④IgD：B细胞表面标志；⑤IgE：介导Ⅰ型超敏反应，抗寄生虫。",
            "questions": [
                {
                    "stem": "唯一能通过胎盘的抗体是？",
                    "options": [
                        {"id": "a", "text": "IgM"},
                        {"id": "b", "text": "IgG"},
                        {"id": "c", "text": "IgA"},
                        {"id": "d", "text": "IgE"}
                    ],
                    "correctAnswers": ["b"],
                    "explanation": "IgG是唯一能通过胎盘的抗体，在新生儿抗感染中起重要作用。"
                }
            ]
        },
        {
            "chapterId": "micro-ch4",
            "name": "免疫应答的基本过程",
            "explanation": "免疫应答分为三个阶段：①识别阶段：抗原提呈细胞摄取、加工、提呈抗原，T、B细胞识别抗原；②活化、增殖、分化阶段：T、B细胞活化、增殖、分化为效应细胞；③效应阶段：效应细胞和效应分子发挥免疫效应。B细胞介导体液免疫，产生抗体；T细胞介导细胞免疫，产生效应T细胞（CTL、Th细胞）。",
            "questions": [
                {
                    "stem": "免疫应答的三个阶段顺序是？",
                    "options": [
                        {"id": "a", "text": "识别→活化增殖分化→效应"},
                        {"id": "b", "text": "活化增殖分化→识别→效应"},
                        {"id": "c", "text": "效应→识别→活化增殖分化"},
                        {"id": "d", "text": "识别→效应→活化增殖分化"}
                    ],
                    "correctAnswers": ["a"],
                    "explanation": "免疫应答的三个阶段顺序是：识别阶段→活化、增殖、分化阶段→效应阶段。"
                }
            ]
        },
        {
            "chapterId": "micro-ch4",
            "name": "超敏反应的类型",
            "explanation": "超敏反应（变态反应）分为四型：①Ⅰ型（速发型）：由IgE介导，发生快，消退也快，如过敏性休克、荨麻疹；②Ⅱ型（细胞毒型）：由IgG、IgM介导，如输血反应、新生儿溶血症；③Ⅲ型（免疫复合物型）：由免疫复合物沉积引起，如肾小球肾炎、血清病；④Ⅳ型（迟发型）：由T细胞介导，发生较慢，如接触性皮炎、结核菌素试验。",
            "questions": [
                {
                    "stem": "接触性皮炎属于哪型超敏反应？",
                    "options": [
                        {"id": "a", "text": "Ⅰ型"},
                        {"id": "b", "text": "Ⅱ型"},
                        {"id": "c", "text": "Ⅲ型"},
                        {"id": "d", "text": "Ⅳ型"}
                    ],
                    "correctAnswers": ["d"],
                    "explanation": "接触性皮炎属于Ⅳ型（迟发型）超敏反应，由T细胞介导，通常在接触抗原24-48小时后发生。"
                }
            ]
        }
    ]

    # 生成知识点和题目
    knowledge_points = []
    questions = []
    kp_counter = 0

    for data in knowledge_data:
        kp_counter += 1
        kp_id = f"kp-micro-{kp_counter:04d}"

        # 知识点
        kp = {
            "id": kp_id,
            "subjectId": "micro",
            "chapterId": data["chapterId"],
            "name": data["name"],
            "explanation": data["explanation"],
            "proficiency": "none",
            "lastReviewedAt": None,
            "nextReviewAt": now,
            "reviewCount": 0,
            "createdAt": now,
            "source": "import"
        }
        knowledge_points.append(kp)

        # 题目
        for q_idx, q_data in enumerate(data["questions"]):
            q_id = f"q-micro-{kp_counter:04d}-{q_idx+1:02d}"
            question = {
                "id": q_id,
                "knowledgePointId": kp_id,
                "subjectId": "micro",
                "type": "single_choice",
                "stem": q_data["stem"],
                "options": q_data["options"],
                "correctAnswers": q_data["correctAnswers"],
                "explanation": q_data["explanation"]
            }
            questions.append(question)

    print(f"  生成知识点: {len(knowledge_points)} 个")
    print(f"  生成题目: {len(questions)} 道")

    # 完整数据结构
    complete_data = {
        "version": "1.0",
        "lastUpdated": now,
        "subjects": [subject],
        "chapters": chapters,
        "knowledgePoints": knowledge_points,
        "questions": questions,
        "total": len(knowledge_points)
    }

    # OSS格式（只包含knowledgePoints和questions）
    oss_data = {
        "version": "1.0",
        "lastUpdated": now,
        "knowledgePoints": knowledge_points,
        "questions": questions,
        "total": len(knowledge_points)
    }

    # 保存文件
    output_dir = Path(__file__).parent.parent / "output" / "微生物与免疫学"
    output_dir.mkdir(parents=True, exist_ok=True)

    complete_file = output_dir / "complete.json"
    oss_file = output_dir / "index.json"

    with open(complete_file, 'w', encoding='utf-8') as f:
        json.dump(complete_data, f, ensure_ascii=False, indent=2)

    with open(oss_file, 'w', encoding='utf-8') as f:
        json.dump(oss_data, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 已保存完整数据: {complete_file}")
    print(f"[OK] 已保存OSS格式: {oss_file}")

    # 更新前端mock数据
    mock_kp_lines = []
    mock_q_lines = []

    for kp in knowledge_points:
        mock_kp_lines.append(f"""  {{
    id: '{kp['id']}', subjectId: '{kp['subjectId']}', chapterId: '{kp['chapterId']}', name: '{kp['name']}',
    explanation: '{kp['explanation']}',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  }},""")

    for q in questions:
        opt_lines = ',\n            '.join([f'{{ id: "{opt["id"]}", text: "{opt["text"]}" }}' for opt in q["options"]])
        mock_q_lines.append(f"""  {{
    id: '{q['id']}', knowledgePointId: '{q['knowledgePointId']}', subjectId: '{q['subjectId']}', type: '{q['type']}',
    stem: '{q['stem']}',
    options: [
            {opt_lines}
    ],
    correctAnswers: {q['correctAnswers']},
    explanation: '{q['explanation']}',
  }},""")

    print("\n[提示] 请手动将知识点和题目添加到 src/data/mock.ts")
    print("  知识点模板:")
    print('\n'.join(mock_kp_lines[:3]) + '\n  ...')
    print("\n  题目模板:")
    print('\n'.join(mock_q_lines[:2]) + '\n  ...')

    print("\n" + "=" * 60)
    print("完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
