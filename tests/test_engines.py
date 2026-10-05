import pathlib
import sqlite3
import sys
import unittest
import tempfile
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from python_worker import campaign,evidence

def row(**changes):
    return dict(source='Meta',campaign='A',day='2026-09-01',spend_cents=10000,impressions=1000,clicks=100,leads=10,sales=2,revenue_cents=30000,**{})|changes

class CampaignTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');campaign.init(self.db)
    def tearDown(self):self.db.close()
    def test_global_metrics_use_totals_not_average_ratios(self):
        campaign.ingest(self.db,[row(leads=1),row(campaign='B',leads=9)])
        result=campaign.summary(self.db)
        self.assertEqual(result['totals']['cpl_cents'],2000)
        self.assertEqual(result['totals']['roas'],3)
    def test_zero_denominators_are_null(self):
        campaign.ingest(self.db,[row(spend_cents=0,leads=0,sales=0,clicks=0,impressions=0)])
        metrics=campaign.summary(self.db)['totals']
        for key in ('cpl_cents','cpa_cents','roas','ctr','lead_conversion'):self.assertIsNone(metrics[key])
    def test_duplicate_import_is_idempotent(self):
        campaign.ingest(self.db,[row()]);result=campaign.ingest(self.db,[row()])
        self.assertEqual(result,{'inserted':0,'duplicates':1})
        self.assertEqual(campaign.summary(self.db)['records'],1)
    def test_conflicting_duplicate_rolls_back_whole_batch(self):
        campaign.ingest(self.db,[row()])
        with self.assertRaises(campaign.ValidationError):campaign.ingest(self.db,[row(campaign='New'),row(leads=11)])
        self.assertEqual(campaign.summary(self.db)['records'],1)
    def test_invalid_row_blocks_entire_batch(self):
        with self.assertRaises(campaign.ValidationError):campaign.ingest(self.db,[row(),row(campaign='B',spend_cents=-1)])
        self.assertEqual(campaign.summary(self.db)['records'],0)
    def test_rejects_bool_and_float_counts(self):
        for value in (True,1.5,'1'):
            with self.assertRaises(campaign.ValidationError):campaign.ingest(self.db,[row(leads=value)])
    def test_date_range_and_invalid_dates(self):
        with self.assertRaises(campaign.ValidationError):campaign.summary(self.db,'2026-09-15','2026-09-01')
        with self.assertRaises(campaign.ValidationError):campaign.ingest(self.db,[row(day='2026-02-30')])
    def test_filter_excludes_out_of_period_records(self):
        campaign.ingest(self.db,[row(),row(day='2026-09-02')])
        self.assertEqual(campaign.summary(self.db,'2026-09-02','2026-09-02')['records'],1)
    def test_seed_is_repeatable(self):
        campaign.seed(self.db);campaign.seed(self.db)
        self.assertEqual(campaign.summary(self.db)['records'],42)

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:');evidence.init(self.db);evidence.seed(self.db)
    def tearDown(self):self.db.close()
    def test_search_returns_original_source_excerpt(self):
        result=evidence.search(self.db,'¿Cuánto tarda la entrega?')
        self.assertTrue(result['found'])
        first=result['citations'][0]
        content=self.db.execute('SELECT content FROM documents WHERE id=?',(first['document_id'],)).fetchone()[0]
        self.assertIn(first['excerpt'],content)
        self.assertEqual(first['title'],'Guía de entregas')
    def test_unknown_topic_abstains(self):
        self.assertFalse(evidence.search(self.db,'fotosíntesis dinosaurios')['found'])
    def test_spanish_accents_and_controlled_synonyms(self):
        self.assertTrue(evidence.search(self.db,'envíos')['found'])
        self.assertTrue(evidence.search(self.db,'contraseña')['found'])
    def test_duplicate_document_is_not_added_twice(self):
        content='Documento de prueba con suficientes palabras para indexar su contenido.'
        first=evidence.ingest(self.db,'Prueba',content);second=evidence.ingest(self.db,'Prueba',content)
        self.assertEqual(first['id'],second['id']);self.assertTrue(second['replayed'])
        self.assertEqual(len(evidence.documents(self.db)),7)
    def test_long_document_is_chunked_and_searchable(self):
        content=' '.join(['inventario']*190)
        result=evidence.ingest(self.db,'Inventario largo',content)
        self.assertEqual(result['chunks'],3)
        self.assertTrue(evidence.search(self.db,'inventario')['found'])
    def test_query_cannot_execute_sql(self):
        evidence.search(self.db,"'; DROP TABLE documents; --")
        self.assertEqual(len(evidence.documents(self.db)),6)
    def test_invalid_and_oversized_documents_rejected(self):
        for content in ('breve','a'*40001):
            with self.assertRaises(campaign.ValidationError):evidence.ingest(self.db,'Prueba',content)
    def test_stopword_only_query_does_not_fabricate_evidence(self):
        self.assertFalse(evidence.search(self.db,'de la y para')['found'])

class SeedConcurrencyTests(unittest.TestCase):
    def check_seed(self,engine,table,expected):
        with tempfile.TemporaryDirectory() as folder:
            path=str(pathlib.Path(folder)/'seed.sqlite')
            with sqlite3.connect(path) as db:engine.init(db)
            def worker(_):
                with sqlite3.connect(path,timeout=5) as db:
                    engine.seed(db)
                    return db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            with ThreadPoolExecutor(max_workers=4) as pool:
                results=list(pool.map(worker,range(4)))
            self.assertEqual(results,[expected]*4)
    def test_campaign_seed_is_atomic_across_connections(self):
        self.check_seed(campaign,'campaign_daily',42)
    def test_document_seed_is_atomic_across_connections(self):
        self.check_seed(evidence,'documents',6)

if __name__=='__main__':unittest.main()
