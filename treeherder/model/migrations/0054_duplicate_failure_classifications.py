# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0053_add_job_platform_option_push_index'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
BEGIN;

-- Disable foreign key checks
SET FOREIGN_KEY_CHECKS=0;

-- Create model TextLogErrorMatch
CREATE TABLE `text_log_error_match`
    (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY,
     `score` numeric(3, 2) NULL,
     `classified_failure_id` bigint NOT NULL,
     `matcher_id` integer NOT NULL,
     `text_log_error_id` bigint NOT NULL,
     INDEX `text_log_error_match_9f0d755f` (`classified_failure_id`),
     INDEX `text_log_error_match_ad8a0085` (`text_log_error_id`),
     CONSTRAINT `text_log_error_match_text_log_error_id_192a8c4c_uniq`
         UNIQUE (`text_log_error_id`, `classified_failure_id`, `matcher_id`),
     CONSTRAINT `text_log_classified_failure_id_1b38b499_fk_classified_failure_id`
         FOREIGN KEY (`classified_failure_id`) REFERENCES `classified_failure` (`id`),
     CONSTRAINT `text_log_error_match_matcher_id_9b9dbb12_fk_matcher_id`
         FOREIGN KEY (`matcher_id`) REFERENCES `matcher` (`id`),
     CONSTRAINT `text_log_error_m_text_log_error_id_09109841_fk_text_log_error_id`
         FOREIGN KEY (`text_log_error_id`) REFERENCES `text_log_error` (`id`));

-- Add field best_classification to textlogerror
-- Add field best_is_verified to textlogerror
-- Add field failure_line to textlogerror
ALTER TABLE `text_log_error`
    ADD COLUMN `best_classification_id` bigint NULL,
    ADD COLUMN `best_is_verified` bool DEFAULT 0 NOT NULL,
    ADD COLUMN `failure_line_id` bigint NULL UNIQUE,
    ADD INDEX `text_log_error_7a340891` (`best_classification_id`),
    ADD CONSTRAINT `text_lo_best_classification_id_5a40639a_fk_classified_failure_id`
        FOREIGN KEY (`best_classification_id`) REFERENCES `classified_failure` (`id`),
    ADD CONSTRAINT `text_log_error_failure_line_id_c0d8c8b0_fk_failure_line_id`
        FOREIGN KEY (`failure_line_id`) REFERENCES `failure_line` (`id`);
ALTER TABLE `text_log_error`
    ALTER COLUMN `best_classification_id` DROP DEFAULT,
    ALTER COLUMN `best_is_verified` DROP DEFAULT,
    ALTER COLUMN `failure_line_id` DROP DEFAULT;

COMMIT;""",

            reverse_sql="""
BEGIN;
--
-- Alter unique_together for textlogerrormatch (1 constraint(s))
--
ALTER TABLE `text_log_error_match` DROP INDEX `text_log_error_match_text_log_error_id_2256a44fd6cd0b2b_uniq`;
--
-- Add field text_log_errors to classifiedfailure
--
--
-- Add field text_log_error to textlogerrormatch
--
ALTER TABLE `text_log_error_match` DROP FOREIGN KEY `text_log_text_log_error_id_2a91351ff186eb06_fk_text_log_error_id`;
ALTER TABLE `text_log_error_match` DROP COLUMN `text_log_error_id` CASCADE;
--
-- Add field failure_line to textlogerror
--
ALTER TABLE `text_log_error` DROP FOREIGN KEY `text_log_err_failure_line_id_561b470d2b4bf666_fk_failure_line_id`;
ALTER TABLE `text_log_error` DROP COLUMN `failure_line_id` CASCADE;
--
-- Add field best_is_verified to textlogerror
--
ALTER TABLE `text_log_error` DROP COLUMN `best_is_verified` CASCADE;
--
-- Add field best_classification to textlogerror
--
ALTER TABLE `text_log_error` DROP FOREIGN KEY `D34ff0a36c9e55f67a0b7f5b1478bf69`;
ALTER TABLE `text_log_error` DROP COLUMN `best_classification_id` CASCADE;
--
-- Create model TextLogErrorMatch
--
DROP TABLE `text_log_error_match` CASCADE;
COMMIT;""",

            state_operations=[
                migrations.CreateModel(
                    name='TextLogErrorMatch',
                    fields=[
                        ('id', models.BigAutoField(serialize=False, primary_key=True)),
                        ('score', models.DecimalField(null=True, max_digits=3, decimal_places=2, blank=True)),
                        ('classified_failure', models.ForeignKey(related_name='error_matches', to='model.ClassifiedFailure')),
                        ('matcher', models.ForeignKey(to='model.Matcher')),
                    ],
                    options={
                        'db_table': 'text_log_error_match',
                        'verbose_name_plural': 'text log error matches',
                    },
                ),
                migrations.AddField(
                    model_name='textlogerror',
                    name='best_classification',
                    field=models.ForeignKey(related_name='best_for_errors', on_delete=django.db.models.deletion.SET_NULL, to='model.ClassifiedFailure', null=True),
                ),
                migrations.AddField(
                    model_name='textlogerror',
                    name='best_is_verified',
                    field=models.BooleanField(default=False),
                ),
                migrations.AddField(
                    model_name='textlogerror',
                    name='failure_line',
                    field=models.OneToOneField(related_name='text_log_error', null=True, to='model.FailureLine'),
                ),
                migrations.AddField(
                    model_name='textlogerrormatch',
                    name='text_log_error',
                    field=models.ForeignKey(related_name='matches', to='model.TextLogError'),
                ),
                migrations.AddField(
                    model_name='classifiedfailure',
                    name='text_log_errors',
                    field=models.ManyToManyField(related_name='classified_failures', through='model.TextLogErrorMatch', to='model.TextLogError'),
                ),
                migrations.AlterUniqueTogether(
                    name='textlogerrormatch',
                    unique_together=set([('text_log_error', 'classified_failure', 'matcher')]),
                ),
            ])]
